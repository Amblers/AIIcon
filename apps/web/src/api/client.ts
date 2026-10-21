import type {
  ApiErrorBody,
  ApiErrorCode,
  DeepSeekConfig,
  GenerateRequest,
  GenerateResponse,
  TestConnectionResponse,
} from '@aiicon/shared';

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK_ERROR';
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: string[];
  readonly requestId?: string;

  constructor(
    code: ApiErrorCode | 'NETWORK_ERROR',
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      details?: string[];
      requestId?: string;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options.status ?? 0;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(error?.code ?? 'INTERNAL_ERROR', error?.message ?? '请求失败，请稍后重试。', {
      status: response.status,
      retryable: error?.retryable ?? response.status >= 500,
      details: error?.details,
      requestId: error?.requestId,
    });
  }

  return body as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new ApiError('CANCELED', '已取消。', { status: 499, retryable: true });
    }
    throw new ApiError('NETWORK_ERROR', '无法连接本地服务，请确认服务已启动。', {
      status: 0,
      retryable: true,
    });
  }
  return parseResponse<T>(response);
}

export const api = {
  getConfig(): Promise<DeepSeekConfig> {
    return request<DeepSeekConfig>('/api/config');
  },

  saveConfig(payload: { apiKey?: string; model: string }): Promise<DeepSeekConfig> {
    return request<DeepSeekConfig>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  clearKey(): Promise<DeepSeekConfig> {
    return request<DeepSeekConfig>('/api/config/key', { method: 'DELETE' });
  },

  testConnection(payload: { apiKey?: string; model?: string }): Promise<TestConnectionResponse> {
    return request<TestConnectionResponse>('/api/config/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateIcon(payload: GenerateRequest, signal?: AbortSignal): Promise<GenerateResponse> {
    return request<GenerateResponse>('/api/icons/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
  },
};
