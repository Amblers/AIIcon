import type { ApiErrorCode } from './types';

export const ERROR_COPY: Record<ApiErrorCode, { message: string; retryable: boolean }> = {
  CONFIG_MISSING: {
    message: '请先配置 DeepSeek API Key。',
    retryable: false,
  },
  CONFIG_ENV_READONLY: {
    message: '当前 API Key 来自环境变量，请在环境变量中修改。',
    retryable: false,
  },
  INVALID_API_KEY: {
    message: 'API Key 无效，请更新后重试。',
    retryable: false,
  },
  INSUFFICIENT_BALANCE: {
    message: 'DeepSeek 账户余额不足，请充值后重试。',
    retryable: false,
  },
  INVALID_MODEL: {
    message: '当前模型不可用，请检查模型名称。',
    retryable: false,
  },
  RATE_LIMITED: {
    message: '请求过于频繁，请稍后再试。',
    retryable: true,
  },
  UPSTREAM_TIMEOUT: {
    message: '生成超时，可以重试或减少批量任务。',
    retryable: true,
  },
  UPSTREAM_ERROR: {
    message: 'DeepSeek 服务暂时不可用，请稍后重试。',
    retryable: true,
  },
  NETWORK_ERROR: {
    message: '无法连接服务，请检查本地服务或网络。',
    retryable: true,
  },
  EMPTY_RESPONSE: {
    message: '模型未返回有效内容，请重试。',
    retryable: true,
  },
  INVALID_JSON: {
    message: '模型返回内容格式异常，请重试。',
    retryable: true,
  },
  SVG_REJECTED: {
    message: '生成结果未通过安全或结构校验，请重试。',
    retryable: true,
  },
  GENERATION_REJECTED: {
    message: '图标生成失败，请调整描述或关键词后重试。',
    retryable: true,
  },
  COLOR_MISMATCH: {
    message: '生成结果未遵循颜色设置，请重试。',
    retryable: true,
  },
  CONTENT_BLOCKED: {
    message: '这段内容无法生成图标，请调整描述后重试。',
    retryable: false,
  },
  CANCELED: {
    message: '已取消。',
    retryable: true,
  },
  VALIDATION_ERROR: {
    message: '输入内容不完整或格式不正确。',
    retryable: false,
  },
  INTERNAL_ERROR: {
    message: '服务出现异常，请稍后重试。',
    retryable: true,
  },
};
