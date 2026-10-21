import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  DEFAULT_ROUNDED_RADIUS,
  MAX_CONTENT_LENGTH,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS_TOTAL_LENGTH,
  MAX_TASKS,
  TEMPLATE_IDS,
  duplicateBaseNames,
  getTemplate,
  normalizeHex,
  sanitizeBaseName,
  type GenerateRequest,
  type TemplateId,
} from '@aiicon/shared';
import { ApiError, api } from '@/api/client';
import { showToast } from '@/composables/useToast';
import type {
  DraftPayload,
  DraftTask,
  ExportOptions,
  IconResult,
  IconTask,
  ResultStyleSnapshot,
  RunSnapshot,
  RunTaskSnapshot,
  StyleSettings,
  SuccessfulEntry,
  TaskError,
} from '@/types';

const PNG_SIZES = [64, 128, 256, 512, 1024];
const REQUEST_TIMEOUT_MS = 200_000;

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyKeywords(): Record<TemplateId, string[]> {
  const record = {} as Record<TemplateId, string[]>;
  for (const id of TEMPLATE_IDS) record[id] = [];
  return record;
}

function cloneStyle(style: ResultStyleSnapshot): ResultStyleSnapshot {
  return {
    templateId: style.templateId,
    keywords: [...style.keywords],
    primaryColor: style.primaryColor,
    backgroundColor: style.backgroundColor,
    roundedRadiusPx: style.roundedRadiusPx,
  };
}

function errorFrom(error: unknown): TaskError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details?.length ? { details: error.details } : {}),
    };
  }
  return {
    code: 'CLIENT_ERROR',
    message: error instanceof Error ? error.message : '生成失败，请重试。',
    retryable: true,
  };
}

function compareStyle(a: ResultStyleSnapshot, b: ResultStyleSnapshot): boolean {
  return (
    a.templateId === b.templateId &&
    a.primaryColor === b.primaryColor &&
    a.backgroundColor === b.backgroundColor &&
    a.roundedRadiusPx === b.roundedRadiusPx &&
    a.keywords.length === b.keywords.length &&
    a.keywords.every((keyword, index) => keyword === b.keywords[index])
  );
}

function isTaskBlank(task: IconTask): boolean {
  return !task.content.trim() && !task.fileName.trim();
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const templateId = ref<TemplateId>('line');
  const keywordsByTemplate = ref<Record<TemplateId, string[]>>(emptyKeywords());
  const primaryColor = ref<string | null>(null);
  const backgroundColor = ref<string | null>(null);
  const roundedRadiusPx = ref(DEFAULT_ROUNDED_RADIUS);
  const tasks = ref<IconTask[]>([]);
  const results = ref<Record<string, IconResult>>({});
  const exportOptions = reactive<ExportOptions>({
    svg: true,
    png: false,
    pngSize: 512,
  });

  const phase = ref<'idle' | 'running' | 'done'>('idle');
  const runSnapshot = ref<RunSnapshot | null>(null);
  const lastCompletedSnapshot = ref<RunSnapshot | null>(null);
  const runTaskIds = ref<string[]>([]);
  const validationErrors = ref<Record<string, string>>({});
  const cancelRequested = ref(false);
  const activeControllers = new Set<AbortController>();

  const currentTemplate = computed(() => getTemplate(templateId.value));
  const currentKeywords = computed(() => keywordsByTemplate.value[templateId.value] ?? []);
  const isRunning = computed(() => phase.value === 'running');
  const supportsBackground = computed(() => currentTemplate.value.supportsBackground);
  const supportsRadius = computed(() => currentTemplate.value.supportsRadius);

  const activeTasks = computed(() => tasks.value.filter((task) => !isTaskBlank(task)));

  const displayedTasks = computed(() =>
    tasks.value.filter((task) => task.status !== 'idle' || Boolean(results.value[task.id])),
  );

  const successfulEntries = computed<SuccessfulEntry[]>(() =>
    tasks.value.flatMap((task) => {
      const result = results.value[task.id];
      return task.status === 'succeeded' && result ? [{ task, result }] : [];
    }),
  );

  const hasResults = computed(() => Object.keys(results.value).length > 0);
  const canExport = computed(() => successfulEntries.value.length > 0);
  const successfulCount = computed(() => successfulEntries.value.length);

  const progress = computed(() => {
    const targetIds = runTaskIds.value;
    const targetTasks = targetIds
      .map((id) => tasks.value.find((task) => task.id === id))
      .filter((task): task is IconTask => Boolean(task));
    return {
      total: targetTasks.length,
      completed: targetTasks.filter((task) => ['succeeded', 'failed', 'canceled'].includes(task.status))
        .length,
      succeeded: targetTasks.filter((task) => task.status === 'succeeded').length,
      failed: targetTasks.filter((task) => task.status === 'failed').length,
      canceled: targetTasks.filter((task) => task.status === 'canceled').length,
      running: targetTasks.filter((task) => task.status === 'generating').length,
      queued: targetTasks.filter((task) => task.status === 'queued').length,
    };
  });

  const hasStaleResults = computed(() => {
    const currentStyle: ResultStyleSnapshot = {
      templateId: templateId.value,
      keywords: [...currentKeywords.value],
      primaryColor: primaryColor.value,
      backgroundColor: supportsBackground.value ? backgroundColor.value : null,
      roundedRadiusPx: supportsRadius.value ? roundedRadiusPx.value : 0,
    };
    return successfulEntries.value.some(({ task, result }) => {
      const contentChanged = task.content.trim() !== result.sourceContent;
      const styleChanged = !compareStyle(result.styleSnapshot, currentStyle);
      return contentChanged || styleChanged;
    });
  });

  function pad(index: number): string {
    return String(index).padStart(2, '0');
  }

  function nextDefaultFileName(): string {
    const occupied = new Set(
      tasks.value.map((task, index) => sanitizeBaseName(task.fileName, index).toLowerCase()),
    );
    for (let index = 1; index <= MAX_TASKS; index += 1) {
      const candidate = `icon-${pad(index)}`;
      if (!occupied.has(candidate.toLowerCase())) return candidate;
    }
    return `icon-${Date.now().toString(36)}`;
  }

  function makeTask(index: number): IconTask {
    return {
      id: uid('task'),
      content: '',
      fileName: index === 0 ? 'icon-01' : nextDefaultFileName(),
      status: 'idle',
    };
  }

  function initialize(): void {
    if (tasks.value.length === 0) tasks.value.push(makeTask(0));
  }

  function addTask(): string | null {
    if (isRunning.value) return null;
    if (tasks.value.length >= MAX_TASKS) return null;
    const task = makeTask(tasks.value.length);
    tasks.value.push(task);
    return task.id;
  }

  function removeTask(taskId: string): boolean {
    if (isRunning.value) return false;
    const index = tasks.value.findIndex((task) => task.id === taskId);
    if (index < 0) return false;
    tasks.value.splice(index, 1);
    delete results.value[taskId];
    const nextErrors = { ...validationErrors.value };
    delete nextErrors[taskId];
    validationErrors.value = nextErrors;
    return true;
  }

  function clearTaskError(taskId: string): void {
    if (!validationErrors.value[taskId]) return;
    const nextErrors = { ...validationErrors.value };
    delete nextErrors[taskId];
    validationErrors.value = nextErrors;
  }

  function updateContent(taskId: string, value: string): void {
    const task = tasks.value.find((item) => item.id === taskId);
    if (!task) return;
    task.content = value.slice(0, MAX_CONTENT_LENGTH);
    clearTaskError(taskId);
  }

  function updateFileName(taskId: string, value: string): void {
    const task = tasks.value.find((item) => item.id === taskId);
    if (!task) return;
    task.fileName = value.slice(0, 80);
    clearTaskError(taskId);
  }

  function normalizeFileName(taskId: string): void {
    const task = tasks.value.find((item) => item.id === taskId);
    if (!task || !task.fileName.trim()) return;
    const index = tasks.value.findIndex((item) => item.id === taskId);
    task.fileName = sanitizeBaseName(task.fileName, index);
  }

  function setTemplate(next: TemplateId): void {
    if (isRunning.value) return;
    templateId.value = next;
    validationErrors.value = {};
  }

  function addKeyword(raw: string): { ok: boolean; message?: string } {
    if (isRunning.value) return { ok: false, message: '生成过程中不能修改关键词' };
    const keyword = raw.trim().replace(/,/g, '').replace(/\s+/g, ' ');
    if (!keyword) return { ok: false };
    if ([...keyword].length > MAX_KEYWORD_LENGTH) {
      return { ok: false, message: `单个关键词不能超过 ${MAX_KEYWORD_LENGTH} 个字符` };
    }
    const current = keywordsByTemplate.value[templateId.value] ?? [];
    if (current.length >= MAX_KEYWORDS) {
      return { ok: false, message: `最多添加 ${MAX_KEYWORDS} 个关键词` };
    }
    if (current.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      return { ok: false, message: '关键词已存在' };
    }
    if ([...current, keyword].join('').length > MAX_KEYWORDS_TOTAL_LENGTH) {
      return { ok: false, message: '关键词总长度已达上限' };
    }
    keywordsByTemplate.value[templateId.value] = [...current, keyword];
    return { ok: true };
  }

  function removeKeyword(keyword: string): void {
    const current = keywordsByTemplate.value[templateId.value] ?? [];
    keywordsByTemplate.value[templateId.value] = current.filter((item) => item !== keyword);
  }

  function resetKeywords(): void {
    keywordsByTemplate.value[templateId.value] = [];
  }

  function setPrimaryColor(value: string | null): void {
    primaryColor.value = value ? normalizeHex(value) : null;
  }

  function setBackgroundColor(value: string | null): void {
    backgroundColor.value = value ? normalizeHex(value) : null;
  }

  function setRadius(value: number): void {
    const clamped = Math.min(256, Math.max(0, Math.round(value)));
    roundedRadiusPx.value = Number.isFinite(clamped) ? clamped : DEFAULT_ROUNDED_RADIUS;
  }

  function styleSnapshot(): ResultStyleSnapshot {
    return {
      templateId: templateId.value,
      keywords: [...currentKeywords.value],
      primaryColor: primaryColor.value,
      backgroundColor: supportsBackground.value ? backgroundColor.value : null,
      roundedRadiusPx: supportsRadius.value ? roundedRadiusPx.value : 0,
    };
  }

  function validate(onlyTaskIds?: string[]): { ok: boolean; message?: string; taskId?: string } {
    const active = activeTasks.value;
    const allowedIds = onlyTaskIds ? new Set(onlyTaskIds) : null;
    const scope = allowedIds ? active.filter((task) => allowedIds.has(task.id)) : active;
    if (active.length === 0) {
      validationErrors.value = {};
      return { ok: false, message: '请至少填写一个图标内容' };
    }
    if (scope.length === 0) {
      return { ok: false, message: '没有可生成的任务' };
    }

    const errors: Record<string, string> = allowedIds ? { ...validationErrors.value } : {};
    if (allowedIds) {
      for (const task of scope) delete errors[task.id];
    }

    scope.forEach((task) => {
      const content = task.content.trim();
      const rawFileName = task.fileName.trim();
      if (!content) errors[task.id] = '请填写图标内容';
      if (!rawFileName) {
        errors[task.id] ??= '请填写导出文件名';
      } else if ([...rawFileName].length > 80) {
        errors[task.id] ??= '文件名不能超过 80 个字符';
      }
    });

    active.forEach((task, index) => {
      if (!task.fileName.trim()) return;
      task.fileName = sanitizeBaseName(task.fileName, index);
    });

    const names = active.map((task) => sanitizeBaseName(task.fileName, 0));
    const duplicates = new Set(duplicateBaseNames(names));
    if (duplicates.size > 0) {
      scope.forEach((task) => {
        if (duplicates.has(sanitizeBaseName(task.fileName, 0).toLowerCase())) {
          errors[task.id] ??= '导出文件名不能重复';
        }
      });
    }

    validationErrors.value = errors;
    const firstId = scope.find((task) => errors[task.id])?.id;
    if (firstId) {
      return {
        ok: false,
        message: errors[firstId] ?? '请检查输入',
        taskId: firstId,
      };
    }
    return { ok: true };
  }

  async function runOne(taskId: string, snapshot: RunSnapshot): Promise<void> {
    const task = tasks.value.find((item) => item.id === taskId);
    const taskSnapshot = snapshot.tasks.find((item) => item.id === taskId);
    if (!task || !taskSnapshot) return;
    if (cancelRequested.value) {
      task.status = 'canceled';
      return;
    }

    task.status = 'generating';
    const controller = new AbortController();
    activeControllers.add(controller);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const payload: GenerateRequest = {
      content: taskSnapshot.content,
      templateId: snapshot.style.templateId,
      keywords: snapshot.style.keywords,
      primaryColor: snapshot.style.primaryColor,
      backgroundColor: snapshot.style.backgroundColor,
      roundedRadiusPx: snapshot.style.roundedRadiusPx,
    };

    try {
      const response = await api.generateIcon(payload, controller.signal);
      if (cancelRequested.value) {
        task.status = 'canceled';
        return;
      }
      const result: IconResult = {
        ...response,
        id: uid('result'),
        taskId,
        styleSnapshot: cloneStyle(snapshot.style),
        sourceContent: taskSnapshot.content,
        createdAt: new Date().toISOString(),
      };
      results.value[taskId] = result;
      task.status = 'succeeded';
      task.resultId = result.id;
      task.error = undefined;
    } catch (error) {
      if (cancelRequested.value || (!timedOut && controller.signal.aborted)) {
        task.status = 'canceled';
        return;
      }
      if (timedOut) {
        task.status = 'failed';
        task.error = {
          code: 'UPSTREAM_TIMEOUT',
          message: '生成超时，请重试。',
          retryable: true,
        };
        return;
      }
      task.status = 'failed';
      task.error = errorFrom(error);
    } finally {
      window.clearTimeout(timeout);
      activeControllers.delete(controller);
    }
  }

  async function startGeneration(onlyTaskIds?: string[]): Promise<{ ok: boolean; message?: string; taskId?: string }> {
    if (isRunning.value) return { ok: false, message: '当前批次仍在生成中' };
    const validation = validate(onlyTaskIds);
    if (!validation.ok) return validation;

    const allowedIds = new Set(onlyTaskIds ?? []);
    const targets = activeTasks.value.filter(
      (task) => onlyTaskIds === undefined || allowedIds.has(task.id),
    );
    if (targets.length === 0) {
      return { ok: false, message: '没有可生成的图标' };
    }

    const snapshot: RunSnapshot = {
      id: uid('run'),
      startedAt: new Date().toISOString(),
      style: styleSnapshot(),
      tasks: targets.map<RunTaskSnapshot>((task) => ({
        id: task.id,
        content: task.content.trim(),
        fileName: task.fileName,
      })),
    };

    runSnapshot.value = snapshot;
    runTaskIds.value = targets.map((task) => task.id);
    cancelRequested.value = false;
    phase.value = 'running';

    targets.forEach((task) => {
      delete results.value[task.id];
      task.status = 'queued';
      task.resultId = undefined;
      task.error = undefined;
    });

    const queue = [...runTaskIds.value];
    let cursor = 0;

    const worker = async () => {
      while (!cancelRequested.value) {
        const taskId = queue[cursor];
        cursor += 1;
        if (!taskId) return;
        await runOne(taskId, snapshot);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(3, queue.length) }, () => worker()),
    );

    phase.value = 'done';
    lastCompletedSnapshot.value = snapshot;

    const successful = summary().succeeded;
    const failed = summary().failed;
    if (cancelRequested.value) {
      showToast(`已取消生成，已完成 ${successful} 枚。`, 'info');
    } else if (failed > 0) {
      showToast(`生成完成：成功 ${successful} 枚，失败 ${failed} 枚。`, 'error', 4600);
    } else {
      showToast(`生成完成，共 ${successful} 枚图标。`, 'success');
    }

    return { ok: true };
  }

  function summary(): { succeeded: number; failed: number; canceled: number; total: number } {
    const targetTasks = tasks.value.filter((task) => runTaskIds.value.includes(task.id));
    return {
      total: targetTasks.length,
      succeeded: targetTasks.filter((task) => task.status === 'succeeded').length,
      failed: targetTasks.filter((task) => task.status === 'failed').length,
      canceled: targetTasks.filter((task) => task.status === 'canceled').length,
    };
  }

  function cancelGeneration(): void {
    if (!isRunning.value) return;
    cancelRequested.value = true;
    runTaskIds.value.forEach((id) => {
      const task = tasks.value.find((item) => item.id === id);
      if (task?.status === 'queued') task.status = 'canceled';
    });
    activeControllers.forEach((controller) => controller.abort());
  }

  function clearResults(): void {
    if (isRunning.value) return;
    results.value = {};
    tasks.value.forEach((task) => {
      task.status = 'idle';
      task.resultId = undefined;
      task.error = undefined;
    });
    phase.value = 'idle';
    runSnapshot.value = null;
    lastCompletedSnapshot.value = null;
    runTaskIds.value = [];
  }

  function resultForTask(taskId: string): IconResult | null {
    return results.value[taskId] ?? null;
  }

  function taskById(taskId: string | null): IconTask | null {
    if (!taskId) return null;
    return tasks.value.find((task) => task.id === taskId) ?? null;
  }

  function retryFailed(): Promise<{ ok: boolean; message?: string; taskId?: string }> {
    const failedIds = tasks.value
      .filter((task) => task.status === 'failed')
      .map((task) => task.id);
    if (failedIds.length === 0) return Promise.resolve({ ok: false, message: '没有失败的任务' });
    return startGeneration(failedIds);
  }

  function currentStyle(): StyleSettings {
    return {
      templateId: templateId.value,
      keywordsByTemplate: Object.fromEntries(
        TEMPLATE_IDS.map((id) => [id, [...(keywordsByTemplate.value[id] ?? [])]]),
      ) as Record<TemplateId, string[]>,
      primaryColor: primaryColor.value,
      backgroundColor: backgroundColor.value,
      roundedRadiusPx: roundedRadiusPx.value,
    };
  }

  function hydrateDraft(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<DraftPayload>;
    if (candidate.version !== 1) return false;
    if (!candidate.templateId || !TEMPLATE_IDS.includes(candidate.templateId)) return false;

    templateId.value = candidate.templateId;
    const keywords = emptyKeywords();
    if (candidate.keywordsByTemplate && typeof candidate.keywordsByTemplate === 'object') {
      for (const id of TEMPLATE_IDS) {
        const list = candidate.keywordsByTemplate[id];
        if (Array.isArray(list)) {
          keywords[id] = list
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, MAX_KEYWORDS);
        }
      }
    }
    keywordsByTemplate.value = keywords;
    primaryColor.value =
      typeof candidate.primaryColor === 'string' ? normalizeHex(candidate.primaryColor) : null;
    backgroundColor.value =
      typeof candidate.backgroundColor === 'string'
        ? normalizeHex(candidate.backgroundColor)
        : null;
    roundedRadiusPx.value =
      typeof candidate.roundedRadiusPx === 'number'
        ? Math.min(256, Math.max(0, Math.round(candidate.roundedRadiusPx)))
        : DEFAULT_ROUNDED_RADIUS;

    if (candidate.exportOptions && typeof candidate.exportOptions === 'object') {
      exportOptions.svg = Boolean(candidate.exportOptions.svg);
      exportOptions.png = Boolean(candidate.exportOptions.png);
      const size = candidate.exportOptions.pngSize;
      exportOptions.pngSize = PNG_SIZES.includes(size as number) ? (size as number) : 512;
    }

    if (Array.isArray(candidate.tasks)) {
      const restored: IconTask[] = candidate.tasks
        .filter(
          (task): task is DraftTask =>
            Boolean(task) &&
            typeof task === 'object' &&
            typeof (task as DraftTask).id === 'string' &&
            typeof (task as DraftTask).content === 'string' &&
            typeof (task as DraftTask).fileName === 'string',
        )
        .slice(0, MAX_TASKS)
        .map((task) => ({
          id: task.id || uid('task'),
          content: task.content.slice(0, MAX_CONTENT_LENGTH),
          fileName: task.fileName.slice(0, 80),
          status: 'idle' as const,
        }));
      tasks.value = restored;
    }

    results.value = {};
    phase.value = 'idle';
    runSnapshot.value = null;
    lastCompletedSnapshot.value = null;
    runTaskIds.value = [];
    validationErrors.value = {};
    initialize();
    return true;
  }

  const draftPayload = computed<DraftPayload>(() => ({
    version: 1,
    savedAt: new Date().toISOString(),
    templateId: templateId.value,
    keywordsByTemplate: Object.fromEntries(
      TEMPLATE_IDS.map((id) => [id, [...(keywordsByTemplate.value[id] ?? [])]]),
    ) as Record<TemplateId, string[]>,
    primaryColor: primaryColor.value,
    backgroundColor: backgroundColor.value,
    roundedRadiusPx: roundedRadiusPx.value,
    tasks: tasks.value.map((task) => ({
      id: task.id,
      content: task.content,
      fileName: task.fileName,
    })),
    exportOptions: { ...exportOptions },
  }));

  initialize();

  return {
    templateId,
    keywordsByTemplate,
    primaryColor,
    backgroundColor,
    roundedRadiusPx,
    tasks,
    results,
    exportOptions,
    phase,
    runSnapshot,
    lastCompletedSnapshot,
    runTaskIds,
    validationErrors,
    cancelRequested,
    currentTemplate,
    currentKeywords,
    supportsBackground,
    supportsRadius,
    isRunning,
    activeTasks,
    displayedTasks,
    successfulEntries,
    hasResults,
    canExport,
    successfulCount,
    progress,
    hasStaleResults,
    addTask,
    removeTask,
    clearTaskError,
    updateContent,
    updateFileName,
    normalizeFileName,
    setTemplate,
    addKeyword,
    removeKeyword,
    resetKeywords,
    setPrimaryColor,
    setBackgroundColor,
    setRadius,
    validate,
    startGeneration,
    cancelGeneration,
    clearResults,
    resultForTask,
    taskById,
    retryFailed,
    currentStyle,
    hydrateDraft,
    draftPayload,
  };
});
