import { ERROR_COPY, type ApiErrorCode } from '@aiicon/shared';

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: string[];

  constructor(
    code: ApiErrorCode,
    options: {
      message?: string;
      statusCode?: number;
      retryable?: boolean;
      details?: string[];
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? ERROR_COPY[code].message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? ERROR_COPY[code].retryable;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function errorStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case 'CONFIG_MISSING':
      return 400;
    case 'CONFIG_ENV_READONLY':
      return 409;
    case 'INVALID_API_KEY':
      return 401;
    case 'INSUFFICIENT_BALANCE':
      return 402;
    case 'VALIDATION_ERROR':
      return 422;
    case 'RATE_LIMITED':
      return 429;
    case 'UPSTREAM_TIMEOUT':
      return 504;
    case 'UPSTREAM_ERROR':
    case 'EMPTY_RESPONSE':
    case 'INVALID_JSON':
      return 502;
    case 'CANCELED':
      return 499;
    default:
      return 500;
  }
}
