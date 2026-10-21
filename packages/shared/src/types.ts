export const TEMPLATE_IDS = [
  'line',
  'solid',
  'mono',
  'multicolor',
  'circle-bg',
  'square-bg',
  'rounded-bg',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const MAX_TASKS = 20;
export const MAX_CONTENT_LENGTH = 200;
export const MAX_FILENAME_LENGTH = 80;
export const MAX_KEYWORDS = 8;
export const MAX_KEYWORD_LENGTH = 20;
export const MAX_KEYWORDS_TOTAL_LENGTH = 160;
export const DEFAULT_ROUNDED_RADIUS = 96;
export const MAX_ROUNDED_RADIUS = 256;
export const CANVAS_SIZE = 512;

export const DEFAULT_MODEL = 'deepseek-flash';
export const MODEL_PRESETS = ['deepseek-flash', 'deepseek-v4-pro'] as const;

export type TemplateGroup = 'basic' | 'background';

export interface SafeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateSkill {
  id: TemplateId;
  name: string;
  shortName: string;
  group: TemplateGroup;
  tagline: string;
  description: string;
  coreRules: string[];
  negativeRules: string[];
  safeArea: SafeArea;
  suggestedKeywords: string[];
  supportsBackground: boolean;
  supportsRadius: boolean;
  maxColors: number;
}

export interface IconPalette {
  primary: string;
  background: string | null;
  supporting: string[];
}

export interface GenerateRequest {
  content: string;
  templateId: TemplateId;
  keywords: string[];
  primaryColor: string | null;
  backgroundColor: string | null;
  roundedRadiusPx: number;
}

export interface GenerateResponse {
  requestId: string;
  svg: string;
  palette: IconPalette;
  alt: string;
  templateId: TemplateId;
  model: string;
  attempts: number;
  durationMs: number;
  warnings: string[];
}

export type ConfigSource = 'file' | 'env' | 'none';

export interface DeepSeekConfig {
  configured: boolean;
  source: ConfigSource;
  maskedKey: string | null;
  model: string;
  baseUrl: string;
  provider: 'deepseek';
}

export interface TestConnectionResponse {
  ok: boolean;
  model?: string;
  latencyMs?: number;
  error?: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiErrorCode =
  | 'CONFIG_MISSING'
  | 'CONFIG_ENV_READONLY'
  | 'INVALID_API_KEY'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_MODEL'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'INVALID_JSON'
  | 'SVG_REJECTED'
  | 'GENERATION_REJECTED'
  | 'COLOR_MISMATCH'
  | 'CONTENT_BLOCKED'
  | 'CANCELED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    requestId?: string;
    details?: string[];
  };
}

export interface ServerConfigUpdate {
  apiKey?: string;
  model?: string;
}

export interface ServerConfigTest {
  apiKey?: string;
  model?: string;
}
