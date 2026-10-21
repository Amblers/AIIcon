<script setup lang="ts">
import { computed, ref } from 'vue';
import { Download, FileArchive, Image as ImageIcon, LoaderCircle } from 'lucide-vue-next';
import { showToast } from '@/composables/useToast';
import { useWorkspaceStore } from '@/stores/workspace';
import { exportAll } from '@/utils/export';

const workspace = useWorkspaceStore();
const exporting = ref(false);
const progress = ref({ completed: 0, total: 0 });

const count = computed(() => workspace.successfulEntries.length);
const totalSteps = computed(
  () =>
    count.value *
    (Number(workspace.exportOptions.svg) + Number(workspace.exportOptions.png)),
);
const formatsEmpty = computed(() => !workspace.exportOptions.svg && !workspace.exportOptions.png);
const buttonLabel = computed(() => {
  if (exporting.value) return `导出 ${progress.value.completed} / ${progress.value.total}`;
  if (count.value === 1 && workspace.exportOptions.svg !== workspace.exportOptions.png) {
    return workspace.exportOptions.png ? '下载 PNG' : '下载 SVG';
  }
  return `导出 ${count.value} 枚图标`;
});

function toggle(format: 'svg' | 'png'): void {
  if (exporting.value) return;
  workspace.exportOptions[format] = !workspace.exportOptions[format];
}

async function download(): Promise<void> {
  if (exporting.value || count.value === 0 || formatsEmpty.value) return;
  exporting.value = true;
  progress.value = { completed: 0, total: totalSteps.value };
  try {
    const entries = workspace.successfulEntries.map(({ task, result }) => ({
      baseName: task.fileName,
      svg: result.svg,
    }));
    await exportAll(entries, { ...workspace.exportOptions }, (completed, total) => {
      progress.value = { completed, total };
    });
    showToast(
      count.value > 1 || (workspace.exportOptions.svg && workspace.exportOptions.png)
        ? '导出完成，已开始下载 ZIP。'
        : '导出完成，已开始下载。',
      'success',
    );
  } catch (error) {
    showToast(error instanceof Error ? error.message : '导出失败', 'error');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="export-bar">
    <div class="export-summary">
      <span class="export-summary__icon"><FileArchive :size="15" /></span>
      <div>
        <span class="export-summary__title">导出图稿</span>
        <span class="export-summary__meta">
          {{ count }} 枚成功图稿 · 文件名来自左侧清单
        </span>
      </div>
    </div>

    <div class="export-controls">
      <div class="format-toggle" role="group" aria-label="导出格式">
        <button
          type="button"
          class="format-toggle__item"
          :class="{ 'format-toggle__item--active': workspace.exportOptions.svg }"
          :aria-pressed="workspace.exportOptions.svg"
          :disabled="exporting"
          @click="toggle('svg')"
        >
          <FileArchive :size="11" />
          SVG
        </button>
        <button
          type="button"
          class="format-toggle__item"
          :class="{ 'format-toggle__item--active': workspace.exportOptions.png }"
          :aria-pressed="workspace.exportOptions.png"
          :disabled="exporting"
          @click="toggle('png')"
        >
          <ImageIcon :size="11" />
          PNG
        </button>
      </div>

      <label v-if="workspace.exportOptions.png" class="size-select">
        <span class="sr-only">PNG 尺寸</span>
        <select v-model.number="workspace.exportOptions.pngSize" :disabled="exporting">
          <option :value="64">64px</option>
          <option :value="128">128px</option>
          <option :value="256">256px</option>
          <option :value="512">512px</option>
          <option :value="1024">1024px</option>
        </select>
      </label>

      <button
        type="button"
        class="btn btn--primary export-button"
        :disabled="exporting || count === 0 || formatsEmpty || workspace.isRunning"
        @click="download"
      >
        <LoaderCircle v-if="exporting" :size="13" class="spin" />
        <Download v-else :size="13" />
        {{ buttonLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.export-bar {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid var(--line);
  background: rgba(255, 254, 250, 0.88);
  padding: 12px 22px;
  box-shadow: 0 -14px 30px -26px rgba(23, 33, 27, 0.28);
  backdrop-filter: blur(16px);
}

.export-summary {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.export-summary__icon {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: var(--paper);
  color: var(--forest);
}

.export-summary__title {
  display: block;
  color: var(--ink);
  font-size: 11px;
  font-weight: 680;
}

.export-summary__meta {
  display: block;
  overflow: hidden;
  margin-top: 1px;
  color: var(--faint);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.format-toggle {
  display: flex;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  padding: 2px;
}

.format-toggle__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 0 9px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 650;
}

.format-toggle__item--active {
  background: var(--surface);
  color: var(--forest);
  box-shadow: 0 1px 3px rgba(23, 33, 27, 0.08);
}

.size-select select {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  padding: 0 7px;
  color: var(--muted);
  font-size: 10px;
}

.export-button {
  min-height: 36px;
  min-width: 130px;
}

@media (max-width: 760px) {
  .export-bar {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
    padding: 11px 15px;
  }
  .export-controls {
    width: 100%;
  }
  .export-button {
    margin-left: auto;
  }
  .export-summary__meta {
    display: none;
  }
}

@media (max-width: 480px) {
  .export-controls {
    flex-wrap: wrap;
  }
  .export-button {
    width: 100%;
    margin-left: 0;
  }
}
</style>
