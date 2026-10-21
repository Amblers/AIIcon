<script setup lang="ts">
import { computed } from 'vue';
import { AlertCircle, Check, LoaderCircle, Trash2, Undo2 } from 'lucide-vue-next';
import type { IconTask } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace';

const props = defineProps<{
  task: IconTask;
  index: number;
  disabled?: boolean;
  error?: string;
  suffix: string;
}>();

const emit = defineEmits<{ delete: [taskId: string] }>();
const workspace = useWorkspaceStore();

const statusLabel = computed(() => {
  switch (props.task.status) {
    case 'queued':
      return '排队中';
    case 'generating':
      return '生成中';
    case 'succeeded':
      return '已生成';
    case 'failed':
      return '失败';
    case 'canceled':
      return '已取消';
    default:
      return '';
  }
});

const inputId = computed(() => `task-content-${props.task.id}`);
const fileNameId = computed(() => `task-file-${props.task.id}`);

function onContentInput(event: Event): void {
  workspace.updateContent(props.task.id, (event.target as HTMLInputElement).value);
}

function onFileNameInput(event: Event): void {
  workspace.updateFileName(props.task.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
  <article
    class="task-row"
    :class="{
      'task-row--error': Boolean(error) || task.status === 'failed',
      'task-row--active': task.status === 'generating' || task.status === 'queued',
    }"
    :data-task-id="task.id"
  >
    <div class="task-row__head">
      <span class="task-row__number">{{ String(index + 1).padStart(2, '0') }}</span>
      <span v-if="statusLabel" class="task-row__status" :class="`task-row__status--${task.status}`">
        <LoaderCircle
          v-if="task.status === 'generating' || task.status === 'queued'"
          :size="10"
          class="spin"
        />
        <Check v-else-if="task.status === 'succeeded'" :size="10" />
        <AlertCircle v-else-if="task.status === 'failed'" :size="10" />
        <Undo2 v-else :size="10" />
        {{ statusLabel }}
      </span>
      <button
        type="button"
        class="task-row__delete"
        :disabled="disabled"
        :aria-label="`删除第 ${index + 1} 个任务`"
        title="删除任务"
        @click="emit('delete', task.id)"
      >
        <Trash2 :size="13" />
      </button>
    </div>

    <div class="task-row__fields">
      <div class="task-field task-field--content">
        <label :for="inputId" class="task-field__label">图标内容</label>
        <input
          :id="inputId"
          :value="task.content"
          type="text"
          class="task-field__input"
          :class="{ 'task-field__input--error': Boolean(error) && !task.content.trim() }"
          placeholder="例如：购物车、云同步、AI 写作"
          maxlength="200"
          :disabled="disabled"
          autocomplete="off"
          @input="onContentInput"
        />
      </div>

      <div class="task-field task-field--file">
        <label :for="fileNameId" class="task-field__label">导出文件名</label>
        <div class="file-input-wrap">
          <input
            :id="fileNameId"
            :value="task.fileName"
            type="text"
            class="task-field__input"
            :class="{ 'task-field__input--error': Boolean(error) && !task.fileName.trim() }"
            placeholder="icon-01"
            maxlength="80"
            :disabled="disabled"
            spellcheck="false"
            autocomplete="off"
            @input="onFileNameInput"
            @blur="workspace.normalizeFileName(task.id)"
          />
          <span class="file-input-suffix">{{ suffix }}</span>
        </div>
      </div>
    </div>

    <p v-if="error" class="task-row__error">{{ error }}</p>
    <p v-else-if="task.status === 'failed' && task.error" class="task-row__error">
      {{ task.error.message }}
    </p>
  </article>
</template>

<style scoped>
.task-row {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 9px 10px 10px;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.task-row:hover {
  border-color: var(--line-strong);
}

.task-row--error {
  border-color: rgba(187, 68, 60, 0.35);
  background: #fffaf9;
}

.task-row--active {
  border-color: rgba(30, 91, 71, 0.28);
  background: #fbfdf9;
}

.task-row__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
  margin-bottom: 4px;
}

.task-row__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--muted);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.03em;
}

.task-row__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 600;
}

.task-row__status--succeeded {
  color: var(--success);
}

.task-row__status--failed {
  color: var(--danger);
}

.task-row__status--generating,
.task-row__status--queued {
  color: var(--forest);
}

.task-row__delete {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  margin-left: auto;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--faint);
  opacity: 0.28;
  transition: opacity 150ms ease, background 150ms ease, color 150ms ease;
}

.task-row:hover .task-row__delete,
.task-row:focus-within .task-row__delete {
  opacity: 1;
}

.task-row__delete:hover:not(:disabled) {
  background: var(--danger-soft);
  color: var(--danger);
}

.task-row__delete:disabled {
  opacity: 0.2;
}

.task-row__fields {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
  gap: 8px;
}

.task-field {
  min-width: 0;
}

.task-field__label {
  display: block;
  margin-bottom: 4px;
  color: var(--faint);
  font-size: 9.5px;
  font-weight: 600;
}

.task-field__input {
  width: 100%;
  height: 34px;
  border-radius: 7px;
  border-color: transparent;
  background: var(--surface-soft);
  padding: 0 8px;
  font-size: 11.5px;
}

.task-field__input:hover:not(:disabled) {
  border-color: var(--line);
}

.task-field__input:focus {
  border-color: var(--forest);
  background: var(--surface);
}

.task-field__input--error {
  border-color: rgba(187, 68, 60, 0.5);
  background: #fffafa;
}

.file-input-wrap {
  position: relative;
}

.file-input-wrap .task-field__input {
  padding-right: 55px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 10.5px;
}

.file-input-suffix {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8.5px;
  pointer-events: none;
}

.task-row__error {
  margin-top: 6px;
  color: var(--danger);
  font-size: 10px;
  line-height: 1.4;
}

@media (max-width: 520px) {
  .task-row__fields {
    grid-template-columns: 1fr;
  }
  .task-row__delete {
    opacity: 1;
  }
}
</style>
