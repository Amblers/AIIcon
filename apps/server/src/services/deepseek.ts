import { AppError } from '../errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: boolean;
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  latencyMs: number;
}

interface UpstreamErrorShape {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  message?: string;
}

function tryReadError(text: string): string {
  try {
    const parsed = JSON.parse(text) as UpstreamErrorShape;
    return parsed.error?.message || parsed.message || '';
  } catch {
    return text.slice(0, 300);
  }
}

function errorForStatus(status: number, body: string): AppError {
  const message = tryReadError(body);
  const lower = message.toLowerCase();
  if (status === 401 || status === 403) {
    return new AppError('INVALID_API_KEY', {
      statusCode: 401,
      retryable: false,
    });
  }
  if (status === 402) {
    return new AppError('INSUFFICIENT_BALANCE', {
      statusCode: 402,
      retryable: false,
    });
  }
  if (status === 429) {
    return new AppError('RATE_LIMITED', {
      statusCode: 429,
      retryable: true,
    });
  }
  if (status === 400 || status === 404) {
    if (lower.includes('model') || lower.includes('模型')) {
      return new AppError('INVALID_MODEL', {
        statusCode: 502,
        retryable: false,
      });
    }
    return new AppError('UPSTREAM_ERROR', {
      statusCode: 502,
      retryable: false,
      message: 'DeepSeek 拒绝了本次请求，请检查模型配置或稍后重试。',
    });
  }
  if (status >= 500) {
    return new AppError('UPSTREAM_ERROR', {
      statusCode: 502,
      retryable: true,
    });
  }
  return new AppError('UPSTREAM_ERROR', {
    statusCode: 502,
    retryable: false,
    message: 'DeepSeek 返回了异常响应，请稍后重试。',
  });
}

export class DeepSeekClient {
  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const started = Date.now();
    const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          stream: false,
          // DeepSeek enables thinking mode by default (high effort). Icon generation
          // needs the final JSON immediately, and reasoning tokens can otherwise
          // consume the completion budget and leave `content` empty.
          thinking: { type: 'disabled' },
          ...(options.responseFormat ? { response_format: { type: 'json_object' } } : {}),
          max_tokens: options.maxTokens,
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        }),
        signal,
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw new AppError('CANCELED', { statusCode: 499, retryable: true });
      }
      if (timeoutSignal.aborted) {
        throw new AppError('UPSTREAM_TIMEOUT', {
          statusCode: 504,
          retryable: true,
          cause: error,
        });
      }
      throw new AppError('NETWORK_ERROR', {
        statusCode: 502,
        retryable: true,
        cause: error,
      });
    }

    const rawText = await response.text();
    if (!response.ok) {
      throw errorForStatus(response.status, rawText);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new AppError('UPSTREAM_ERROR', {
        statusCode: 502,
        retryable: true,
        message: 'DeepSeek 返回了无法解析的响应，请稍后重试。',
      });
    }

    const data = parsed as {
      model?: string;
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: unknown; reasoning_content?: unknown };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      const choice = data.choices?.[0];
      const reasoning =
        typeof choice?.message?.reasoning_content === 'string'
          ? choice.message.reasoning_content
          : '';
      throw new AppError('EMPTY_RESPONSE', {
        statusCode: 502,
        retryable: true,
        details: [
          `finish_reason=${choice?.finish_reason ?? 'unknown'}`,
          `completion_tokens=${data.usage?.completion_tokens ?? 'unknown'}`,
          `reasoning_tokens=${data.usage?.completion_tokens_details?.reasoning_tokens ?? 0}`,
          `reasoning_content_length=${reasoning.length}`,
        ],
      });
    }

    return {
      content,
      model: data.model || options.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
      latencyMs: Date.now() - started,
    };
  }

  async testConnection(options: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<{ model: string; latencyMs: number }> {
    const result = await this.chat({
      ...options,
      messages: [
        {
          role: 'user',
          content: 'Reply with exactly: pong',
        },
      ],
      maxTokens: 8,
      temperature: 0,
      responseFormat: false,
    });
    return { model: result.model, latencyMs: result.latencyMs };
  }
}
