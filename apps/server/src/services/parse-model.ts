import { ModelResponseSchema, type ModelResponse } from '@aiicon/shared';
import { ZodError } from 'zod';

function stripCodeFence(input: string): string {
  const trimmed = input.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

function firstBalancedObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return input.slice(start, index + 1);
    }
  }
  return null;
}

export interface ParsedModelOutput {
  data: ModelResponse;
  rawJson: string;
}

export class ModelOutputParseError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
    this.name = 'ModelOutputParseError';
  }
}

export function parseModelOutput(raw: string): ParsedModelOutput {
  const cleaned = stripCodeFence(raw);
  const candidates = [cleaned];
  const balanced = firstBalancedObject(cleaned);
  if (balanced && balanced !== cleaned) candidates.push(balanced);

  let parsed: unknown;
  let jsonText = cleaned;
  let parseError: unknown;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      jsonText = candidate;
      parseError = undefined;
      break;
    } catch (error) {
      parseError = error;
    }
  }

  if (parseError !== undefined || parsed === undefined) {
    throw new ModelOutputParseError(
      `模型输出不是有效 JSON：${parseError instanceof Error ? parseError.message : '未知解析错误'}`,
      raw,
    );
  }

  try {
    const data = ModelResponseSchema.parse(parsed);
    return { data, rawJson: jsonText };
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('；');
      throw new ModelOutputParseError(`模型输出结构不符合要求：${details}`, raw);
    }
    throw new ModelOutputParseError('模型输出结构不符合要求。', raw);
  }
}
