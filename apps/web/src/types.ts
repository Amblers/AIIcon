import type {
  ApiErrorCode,
  GenerateResponse,
  IconPalette,
  TemplateId,
} from '@aiicon/shared';

export type TaskStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface TaskError {
  code: ApiErrorCode | 'CLIENT_ERROR';
  message: string;
  retryable: boolean;
  details?: string[];
}

export interface IconTask {
  id: string;
  content: string;
  fileName: string;
  status: TaskStatus;
  resultId?: string;
  error?: TaskError;
}

export interface StyleSettings {
  templateId: TemplateId;
  keywordsByTemplate: Record<TemplateId, string[]>;
  primaryColor: string | null;
  backgroundColor: string | null;
  roundedRadiusPx: number;
}

export interface ResultStyleSnapshot {
  templateId: TemplateId;
  keywords: string[];
  primaryColor: string | null;
  backgroundColor: string | null;
  roundedRadiusPx: number;
}

export interface IconResult extends GenerateResponse {
  id: string;
  taskId: string;
  styleSnapshot: ResultStyleSnapshot;
  sourceContent: string;
  createdAt: string;
}

export interface ExportOptions {
  svg: boolean;
  png: boolean;
  pngSize: number;
}

export interface RunTaskSnapshot {
  id: string;
  content: string;
  fileName: string;
}

export interface RunSnapshot {
  id: string;
  startedAt: string;
  style: ResultStyleSnapshot;
  tasks: RunTaskSnapshot[];
}

export interface DraftTask {
  id: string;
  content: string;
  fileName: string;
}

export interface DraftPayload {
  version: 1;
  savedAt: string;
  templateId: TemplateId;
  keywordsByTemplate: Record<TemplateId, string[]>;
  primaryColor: string | null;
  backgroundColor: string | null;
  roundedRadiusPx: number;
  tasks: DraftTask[];
  exportOptions: ExportOptions;
}

export interface SuccessfulEntry {
  task: IconTask;
  result: IconResult;
}

export type Palette = IconPalette;
