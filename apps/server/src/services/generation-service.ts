import type { GenerateRequestInput, GenerateResponse } from '@aiicon/shared';
import { AppError, isAppError } from '../errors';
import { ConfigVault } from './config-vault';
import { DeepSeekClient } from './deepseek';
import { ModelOutputParseError, parseModelOutput } from './parse-model';
import {
  buildGenerationMessages,
  buildRepairMessages,
  normalizePromptInput,
  type NormalizedPromptInput,
} from './prompt-builder';
import { guardSvg, SvgGuardError } from './svg-guard';

const RETRYABLE_CODES = new Set([
  'RATE_LIMITED',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_ERROR',
  'NETWORK_ERROR',
  'EMPTY_RESPONSE',
]);

interface GenerationDependencies {
  vault: ConfigVault;
  client: DeepSeekClient;
  timeoutMs: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AppError('CANCELED', { statusCode: 499, retryable: true }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AppError('CANCELED', { statusCode: 499, retryable: true }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class GenerationService {
  private readonly vault: ConfigVault;
  private readonly client: DeepSeekClient;
  private readonly timeoutMs: number;

  constructor(dependencies: GenerationDependencies) {
    this.vault = dependencies.vault;
    this.client = dependencies.client;
    this.timeoutMs = dependencies.timeoutMs;
  }

  async generate(
    input: GenerateRequestInput,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<GenerateResponse> {
    const started = Date.now();
    const apiKey = await this.vault.getApiKey();
    if (!apiKey) {
      throw new AppError('CONFIG_MISSING', { statusCode: 400 });
    }
    const model = await this.vault.getModel();
    const baseUrl = this.vault.baseUrl;
    const normalized = normalizePromptInput(input);
    const messages = buildGenerationMessages(normalized);

    let callCount = 0;
    let lastRaw = '';
    let lastErrors: string[] = [];
    let lastParseError: string | undefined;
    let lastModel = model;

    const call = async (
      selectedMessages: typeof messages,
      responseFormat = true,
    ): Promise<string> => {
      callCount += 1;
      const result = await this.client.chat({
        apiKey,
        baseUrl,
        model,
        messages: selectedMessages,
        maxTokens: 8192,
        temperature: 0.7,
        responseFormat,
        timeoutMs: this.timeoutMs,
        signal,
      });
      lastModel = result.model;
      return result.content;
    };

    try {
      try {
        lastRaw = await call(messages);
      } catch (error) {
        if (!isAppError(error) || !error.retryable || !RETRYABLE_CODES.has(error.code)) {
          throw error;
        }
        if (callCount >= 2) throw error;
        if (error.code === 'RATE_LIMITED') await sleep(1500, signal);
        lastRaw = await call(messages);
      }

      try {
        return this.finalize(normalized, lastRaw, lastModel, requestId, started, callCount);
      } catch (error) {
        if (error instanceof ModelOutputParseError) {
          lastErrors = [error.message];
          lastParseError = error.message;
        } else if (error instanceof SvgGuardError) {
          lastErrors = error.details;
          lastParseError = undefined;
        } else {
          throw error;
        }
      }

      if (callCount >= 2) {
        throw new AppError('GENERATION_REJECTED', {
          statusCode: 502,
          retryable: true,
          message: '图标未通过质量校验，请重试或调整描述。',
          details: lastErrors,
        });
      }

      if (signal?.aborted) {
        throw new AppError('CANCELED', { statusCode: 499, retryable: true });
      }

      const repairMessages = buildRepairMessages({
        input: normalized,
        previousOutput: lastRaw,
        errors: lastErrors,
        ...(lastParseError ? { parseError: lastParseError } : {}),
      });
      lastRaw = await call(repairMessages);

      try {
        const repaired = this.finalize(
          normalized,
          lastRaw,
          lastModel,
          requestId,
          started,
          callCount,
        );
        if (lastErrors.length > 0) {
          repaired.warnings = [
            ...repaired.warnings,
            `首次结果经自动修复：${lastErrors.slice(0, 3).join('；')}`.slice(0, 500),
          ];
        }
        return repaired;
      } catch (error) {
        if (error instanceof ModelOutputParseError) {
          throw new AppError('GENERATION_REJECTED', {
            statusCode: 502,
            retryable: true,
            message: '模型连续两次返回了无法使用的图标，请重试。',
            details: [error.message],
          });
        }
        if (error instanceof SvgGuardError) {
          throw new AppError('GENERATION_REJECTED', {
            statusCode: 502,
            retryable: true,
            message: '模型连续两次未通过图标校验，请调整关键词后重试。',
            details: error.details,
          });
        }
        throw error;
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      if (signal?.aborted) {
        throw new AppError('CANCELED', { statusCode: 499, retryable: true });
      }
      throw new AppError('INTERNAL_ERROR', {
        statusCode: 500,
        retryable: true,
        cause: error,
      });
    }
  }

  private finalize(
    input: NormalizedPromptInput,
    raw: string,
    fallbackModel: string,
    requestId: string,
    started: number,
    attempts: number,
  ): GenerateResponse {
    const parsed = parseModelOutput(raw);
    const guarded = guardSvg(parsed.data.svg, parsed.data.palette, parsed.data.alt, {
      templateId: input.templateId,
      primaryColor: input.primaryColor,
      backgroundColor: input.backgroundColor,
      roundedRadiusPx: input.roundedRadiusPx,
    });
    return {
      requestId,
      svg: guarded.svg,
      palette: guarded.palette,
      alt: guarded.alt || input.content,
      templateId: input.templateId,
      model: fallbackModel,
      attempts,
      durationMs: Date.now() - started,
      warnings: guarded.warnings,
    };
  }
}
