<script setup lang="ts">
import { computed } from 'vue';
import {
  AlertCircle,
  Ban,
  Download,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  Sparkles,
} from 'lucide-vue-next';
import { getTemplate } from '@aiicon/shared';
import SvgPreview from '@/components/SvgPreview.vue';
import { showToast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import type { IconResult, IconTask } from '@/types';
import { downloadSvg } from '@/utils/export';

const props = defineProps<{
  task: IconTask;
  result: IconResult | null;
  surface: 'checker' | 'light' | 'dark';
  index: number;
}>();

const workspace = useWorkspaceStore();
const config = useConfigStore();
const ui = useUiStore();

const template = computed(() =>
  props.result ? getTemplate(props.result.styleSnapshot.templateId) : null,
);
const palette = computed(() => props.result?.palette ?? null);
const paletteColors = computed(() => {
  if (!palette.value) return [];
  return [
    palette.value.primary,
    palette.value.background,
    ...palette.value.supporting,
  ].filter((value): value is string => Boolean(value));
});
const aiPicked = computed(
  () =>
    props.result &&
    (props.result.styleSnapshot.primaryColor === null ||
      (props.result.styleSnapshot.backgroundColor === null &&
        template.value?.supportsBackground)),
);
const surfaceClass = computed(() => {
  if (props.surface === 'light') return 'surface-light';
  if (props.surface === 'dark') return 'surface-dark';
  return 'checkerboard';
});

const isActive = computed(
  () => props.task.status === 'queued' || props.task.status === 'generating',
);
const isFailed = computed(() => props.task.status === 'failed');
const isCanceled = computed(() => props.task.status === 'canceled');

function openDetail(): void {
  if (!props.result) return;
  ui.openDetail(props.task.id);
}

async function regenerate(): Promise<void> {
  if (workspace.isRunning) return;
  if (!config.configured) {
    ui.openSettings();
    return;
  }
  const result = await workspace.startGeneration([props.task.id]);
  if (!result.ok) showToast(result.message ?? '无法重新生成', 'error');
}

function download(): void {
  if (!props.result) return;
  try {
    downloadSvg(props.result.svg, props.task.fileName, props.index);
    showToast('SVG 已下载。', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '下载失败', 'error');
  }
}
</script>

<template>
  <article
    class="result-card"
    :class="{
      'result-card--active': isActive,
      'result-card--failed': isFailed,
      'result-card--canceled': isCanceled,
    }"
  >
    <div class="result-preview" :class="surfaceClass">
      <div v-if="result" class="result-art" @click="openDetail">
        <SvgPreview :svg="result.svg" :alt="result.alt || task.content" />
      </div>

      <div v-else-if="isActive" class="result-skeleton" aria-live="polite">
        <div class="skeleton-orb shimmer" />
        <div class="skeleton-line shimmer" />
        <span class="skeleton-label">
          <LoaderCircle :size="11" class="spin" />
          {{ task.status === 'queued' ? '排队中' : '正在绘制' }}
        </span>
      </div>

      <div v-else class="result-state">
        <AlertCircle v-if="isFailed" :size="24" />
        <Ban v-else :size="24" />
        <span>{{ isFailed ? '生成失败' : '已取消' }}</span>
      </div>

      <span v-if="result" class="result-badge">
        <Sparkles :size="10" />
        {{ aiPicked ? 'AI 配色' : '已生成' }}
      </span>

      <div v-if="result" class="result-actions">
        <button
          type="button"
          class="result-action"
          title="重新生成"
          aria-label="重新生成这枚图标"
          :disabled="workspace.isRunning"
          @click.stop="regenerate"
        >
          <RefreshCw :size="13" />
        </button>
        <button
          type="button"
          class="result-action"
          title="下载 SVG"
          aria-label="下载这枚图标的 SVG"
          @click.stop="download"
        >
          <Download :size="13" />
        </button>
        <button
          type="button"
          class="result-action"
          title="查看详情"
          aria-label="查看图标详情"
          @click.stop="openDetail"
        >
          <Maximize2 :size="13" />
        </button>
      </div>
    </div>

    <div class="result-info">
      <div class="result-title-row">
        <span class="result-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <h3 class="result-file" :title="`${task.fileName}.svg`">{{ task.fileName }}</h3>
        <span v-if="result" class="result-extension">.svg</span>
      </div>

      <p v-if="result" class="result-content">{{ task.content }}</p>
      <p v-if="result" class="result-meta">
        {{ template?.name }} · {{ result.durationMs < 1000 ? `${result.durationMs}ms` : `${(result.durationMs / 1000).toFixed(1)}s` }}
        <span v-if="result.warnings.length" class="result-warning">· 已自动校正</span>
      </p>

      <div v-if="result" class="result-bottom">
        <div class="palette-dots" :aria-label="`色板：${paletteColors.join('、')}`">
          <span
            v-for="(color, colorIndex) in paletteColors"
            :key="`${color}-${colorIndex}`"
            class="palette-dot"
            :style="{ backgroundColor: color }"
            :title="color"
          />
          <span class="palette-caption">{{ aiPicked ? 'AI palette' : 'palette' }}</span>
        </div>
        <button type="button" class="result-detail-link" @click="openDetail">
          查看
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <div v-else-if="isFailed" class="result-error">
        <p>{{ task.error?.message ?? '生成失败，请重试。' }}</p>
        <p v-if="task.error?.details?.[0]" class="result-error__detail">
          {{ task.error.details[0] }}
        </p>
        <button type="button" class="btn btn--sm btn--outline" :disabled="workspace.isRunning" @click="regenerate">
          <RefreshCw :size="12" />
          重试这一枚
        </button>
      </div>

      <div v-else-if="isCanceled" class="result-canceled">
        <p>任务已取消，可单独重新生成。</p>
        <button type="button" class="btn btn--sm btn--outline" :disabled="workspace.isRunning" @click="regenerate">
          <RefreshCw :size="12" />
          重新生成
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.result-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}

.result-card:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-lift);
}

.result-card--failed {
  border-color: rgba(187, 68, 60, 0.22);
}

.result-card--active {
  border-color: rgba(30, 91, 71, 0.2);
}

.result-preview {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1.14;
  min-height: 166px;
  overflow: hidden;
}

.result-art {
  display: grid;
  place-items: center;
  width: 56%;
  max-width: 148px;
  aspect-ratio: 1;
  cursor: zoom-in;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.result-card:hover .result-art {
  transform: scale(1.035);
}

.result-badge {
  position: absolute;
  top: 11px;
  left: 11px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  background: rgba(255, 254, 250, 0.8);
  padding: 0 7px;
  color: var(--forest);
  font-size: 9px;
  font-weight: 650;
  backdrop-filter: blur(7px);
}

.result-actions {
  position: absolute;
  top: 9px;
  right: 9px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 160ms ease, transform 160ms ease;
}

.result-card:hover .result-actions,
.result-card:focus-within .result-actions {
  opacity: 1;
  transform: translateY(0);
}

.result-action {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 7px;
  background: rgba(255, 254, 250, 0.8);
  color: var(--ink-soft);
  box-shadow: 0 2px 7px rgba(23, 33, 27, 0.08);
  backdrop-filter: blur(7px);
}

.result-action:hover:not(:disabled) {
  background: var(--ink);
  color: #fff;
}

.result-action:disabled {
  opacity: 0.45;
}

.result-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
}

.skeleton-orb {
  width: 74px;
  height: 74px;
  border-radius: 22px;
}

.skeleton-line {
  width: 55px;
  height: 7px;
  border-radius: 99px;
}

.skeleton-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 9.5px;
}

.result-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  color: var(--faint);
  font-size: 10.5px;
}

.result-card--failed .result-state {
  color: var(--danger);
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 1px solid var(--line);
  padding: 11px 12px 12px;
}

.result-title-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.result-index {
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8.5px;
}

.result-file {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-extension {
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8.5px;
}

.result-content {
  overflow: hidden;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meta {
  color: var(--faint);
  font-size: 9px;
  line-height: 1.4;
}

.result-warning {
  color: var(--warning);
}

.result-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 3px;
}

.palette-dots {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.palette-dot {
  width: 11px;
  height: 11px;
  flex: 0 0 auto;
  border: 1px solid rgba(23, 33, 27, 0.13);
  border-radius: 4px;
}

.palette-caption {
  overflow: hidden;
  margin-left: 3px;
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-detail-link {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 600;
}

.result-detail-link:hover {
  color: var(--forest);
}

.result-error,
.result-canceled {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 3px;
}

.result-error p {
  color: var(--danger);
  font-size: 10px;
  line-height: 1.45;
}

.result-error__detail {
  display: -webkit-box;
  overflow: hidden;
  color: var(--faint) !important;
  font-size: 9px !important;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.result-canceled p {
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 520px) {
  .result-actions {
    opacity: 1;
    transform: none;
  }
}
</style>
