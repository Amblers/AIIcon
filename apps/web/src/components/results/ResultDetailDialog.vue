<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-vue-next';
import { getTemplate } from '@aiicon/shared';
import BaseModal from '@/components/ui/BaseModal.vue';
import SvgPreview from '@/components/SvgPreview.vue';
import { showToast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { copyText, downloadPng, downloadSvg } from '@/utils/export';

const workspace = useWorkspaceStore();
const config = useConfigStore();
const ui = useUiStore();
const copied = ref(false);
const downloadingPng = ref(false);

const task = computed(() => workspace.taskById(ui.detailTaskId));
const result = computed(() => (task.value ? workspace.resultForTask(task.value.id) : null));
const open = computed({
  get: () => Boolean(ui.detailTaskId && task.value && result.value),
  set: (value: boolean) => {
    if (!value) ui.closeDetail();
  },
});

const template = computed(() =>
  result.value ? getTemplate(result.value.styleSnapshot.templateId) : null,
);

const paletteColors = computed(() => {
  if (!result.value) return [];
  return [
    { label: '主色', value: result.value.palette.primary },
    ...(result.value.palette.background
      ? [{ label: '背景', value: result.value.palette.background }]
      : []),
    ...result.value.palette.supporting.map((value, index) => ({
      label: `辅助 ${index + 1}`,
      value,
    })),
  ];
});

const createdAt = computed(() => {
  if (!result.value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(result.value.createdAt));
});

const taskIndex = computed(() => {
  if (!task.value) return 0;
  return Math.max(
    workspace.tasks.findIndex((item) => item.id === task.value?.id),
    0,
  );
});


const aiPicked = computed(
  () =>
    result.value &&
    (result.value.styleSnapshot.primaryColor === null ||
      (template.value?.supportsBackground && result.value.styleSnapshot.backgroundColor === null)),
);

async function copySource(): Promise<void> {
  if (!result.value) return;
  try {
    await copyText(result.value.svg);
    copied.value = true;
    showToast('SVG 源码已复制。', 'success');
    window.setTimeout(() => (copied.value = false), 2000);
  } catch {
    showToast('复制失败，请手动选择源码。', 'error');
  }
}

function downloadSvgFile(): void {
  if (!result.value || !task.value) return;
  const index = workspace.tasks.findIndex((item) => item.id === task.value?.id);
  try {
    downloadSvg(result.value.svg, task.value.fileName, Math.max(index, 0));
    showToast('SVG 已下载。', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '下载失败', 'error');
  }
}

async function downloadPngFile(): Promise<void> {
  if (!result.value || !task.value || downloadingPng.value) return;
  downloadingPng.value = true;
  const index = workspace.tasks.findIndex((item) => item.id === task.value?.id);
  try {
    await downloadPng(
      result.value.svg,
      task.value.fileName,
      workspace.exportOptions.pngSize,
      Math.max(index, 0),
    );
    showToast(`PNG（${workspace.exportOptions.pngSize}px）已下载。`, 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'PNG 导出失败', 'error');
  } finally {
    downloadingPng.value = false;
  }
}

async function regenerate(): Promise<void> {
  if (!task.value) return;
  ui.closeDetail();
  if (!config.configured) {
    ui.openSettings();
    return;
  }
  const response = await workspace.startGeneration([task.value.id]);
  if (!response.ok) showToast(response.message ?? '无法重新生成', 'error');
}
</script>

<template>
  <BaseModal
    v-model="open"
    title="图标详情"
    :subtitle="task ? `${task.fileName}.svg · ${template?.name}` : ''"
    width="wide"
  >
    <div v-if="task && result" class="detail-layout">
      <div class="detail-preview checkerboard">
        <div class="detail-art">
          <SvgPreview :svg="result.svg" :alt="result.alt || task.content" />
        </div>
        <span class="detail-preview__caption">
          <Sparkles :size="11" />
          {{ aiPicked ? 'AI 规划配色' : '自定义配色' }}
        </span>
      </div>

      <div class="detail-info">
        <div class="detail-heading">
          <div>
            <span class="eyebrow">ICON SPECIMEN {{ String(taskIndex + 1).padStart(2, '0') }}</span>
            <h3>{{ task.content }}</h3>
          </div>
          <span class="detail-model">{{ result.model }}</span>
        </div>

        <p v-if="result.alt" class="detail-alt">{{ result.alt }}</p>

        <dl class="meta-grid">
          <div>
            <dt>文件</dt>
            <dd>{{ task.fileName }}.svg</dd>
          </div>
          <div>
            <dt>模板</dt>
            <dd>{{ template?.name }}</dd>
          </div>
          <div>
            <dt>耗时</dt>
            <dd>{{ result.durationMs < 1000 ? `${result.durationMs}ms` : `${(result.durationMs / 1000).toFixed(1)}s` }}</dd>
          </div>
          <div>
            <dt>模型调用</dt>
            <dd>{{ result.attempts }} 次</dd>
          </div>
          <div>
            <dt>创建</dt>
            <dd>{{ createdAt }}</dd>
          </div>
          <div>
            <dt>请求 ID</dt>
            <dd class="meta-mono">{{ result.requestId.slice(0, 8) }}</dd>
          </div>
        </dl>

        <div class="detail-section">
          <div class="detail-section__head">
            <span>实际色板</span>
            <span v-if="aiPicked" class="ai-tag">AI 选色</span>
          </div>
          <div class="palette-list">
            <div v-for="color in paletteColors" :key="color.label" class="palette-item">
              <span class="palette-swatch" :style="{ backgroundColor: color.value }" />
              <span class="palette-label">{{ color.label }}</span>
              <code>{{ color.value }}</code>
            </div>
          </div>
        </div>

        <div v-if="result.warnings.length" class="detail-warning">
          <Sparkles :size="12" />
          <span>{{ result.warnings.join('；') }}</span>
        </div>

        <div class="detail-section detail-section--code">
          <div class="detail-section__head">
            <span><FileCode2 :size="12" /> SVG 源码</span>
            <button type="button" class="mini-action" @click="copySource">
              <Check v-if="copied" :size="11" />
              <Copy v-else :size="11" />
              {{ copied ? '已复制' : '复制' }}
            </button>
          </div>
          <pre>{{ result.svg }}</pre>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn--ghost detail-regenerate" :disabled="workspace.isRunning" @click="regenerate">
        <RefreshCw :size="13" />
        重新生成
      </button>
      <div class="detail-actions">
        <button type="button" class="btn btn--outline" @click="downloadSvgFile">
          <Download :size="13" />
          SVG
        </button>
        <button type="button" class="btn btn--primary" :disabled="downloadingPng" @click="downloadPngFile">
          <LoaderCircle v-if="downloadingPng" :size="13" class="spin" />
          <ImageIcon v-else :size="13" />
          PNG {{ workspace.exportOptions.pngSize }}px
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.detail-layout {
  display: grid;
  grid-template-columns: minmax(270px, 0.82fr) minmax(0, 1.18fr);
  gap: 24px;
  align-items: start;
}

.detail-preview {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 370px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 28px;
}

.detail-art {
  display: grid;
  place-items: center;
  width: min(290px, 76%);
  aspect-ratio: 1;
}

.detail-preview__caption {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--forest);
  font-size: 9px;
  font-weight: 650;
}

.detail-info {
  min-width: 0;
}

.detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.detail-heading h3 {
  margin-top: 5px;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.detail-model {
  flex: 0 0 auto;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-soft);
  padding: 4px 8px;
  color: var(--muted);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8.5px;
}

.detail-alt {
  margin-top: 8px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.55;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 17px 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.meta-grid > div {
  min-width: 0;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 8px 10px;
}

.meta-grid > div:nth-child(3n) {
  border-right: 0;
}

.meta-grid > div:nth-last-child(-n + 3) {
  border-bottom: 0;
}

.meta-grid dt {
  color: var(--faint);
  font-size: 8.5px;
  font-weight: 600;
}

.meta-grid dd {
  overflow: hidden;
  margin: 3px 0 0;
  color: var(--ink-soft);
  font-size: 10.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-mono {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9px !important;
}

.detail-section {
  margin-top: 14px;
}

.detail-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
  color: var(--ink-soft);
  font-size: 10px;
  font-weight: 650;
}

.detail-section__head > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ai-tag {
  border-radius: 99px;
  background: var(--acid-soft);
  padding: 2px 6px;
  color: #6b711f !important;
  font-size: 8px;
  font-weight: 650;
}

.palette-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 26px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-soft);
  padding: 0 7px;
}

.palette-swatch {
  width: 15px;
  height: 15px;
  border: 1px solid rgba(23, 33, 27, 0.12);
  border-radius: 4px;
}

.palette-label {
  color: var(--muted);
  font-size: 9.5px;
}

.palette-item code {
  margin-left: auto;
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9px;
}

.detail-warning {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 12px;
  border-radius: 7px;
  background: var(--warning-soft);
  padding: 7px 8px;
  color: var(--warning);
  font-size: 9.5px;
  line-height: 1.45;
}

.detail-warning svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.detail-section--code {
  margin-top: 16px;
}

.mini-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  padding: 3px 7px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
}

.mini-action:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

pre {
  max-height: 150px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f7f5ef;
  padding: 9px;
  color: #4e5a51;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-regenerate {
  margin-right: auto;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .detail-preview {
    position: static;
    min-height: 260px;
  }
  .detail-art {
    width: 190px;
  }
}

@media (max-width: 560px) {
  .meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .meta-grid > div:nth-child(3n) {
    border-right: 1px solid var(--line);
  }
  .meta-grid > div:nth-child(2n) {
    border-right: 0;
  }
  .meta-grid > div:nth-last-child(-n + 3) {
    border-bottom: 1px solid var(--line);
  }
  .meta-grid > div:nth-last-child(-n + 2) {
    border-bottom: 0;
  }
  .detail-actions {
    margin-left: auto;
  }
  .detail-regenerate {
    display: none;
  }
}
</style>
