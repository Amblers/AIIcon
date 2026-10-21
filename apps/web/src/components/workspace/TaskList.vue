<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { Plus } from 'lucide-vue-next';
import { MAX_TASKS } from '@aiicon/shared';
import { showToast } from '@/composables/useToast';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import TaskRow from './TaskRow.vue';

defineProps<{ disabled?: boolean }>();
const workspace = useWorkspaceStore();
const ui = useUiStore();

const suffix = computed(() => {
  if (workspace.exportOptions.svg && workspace.exportOptions.png) return '.svg/.png';
  if (workspace.exportOptions.png) return '.png';
  return '.svg';
});

const taskCount = computed(() => workspace.tasks.length);

async function addTask(): Promise<void> {
  if (taskCount.value >= MAX_TASKS) {
    showToast(`每批最多 ${MAX_TASKS} 个图标`, 'info');
    return;
  }
  const id = workspace.addTask();
  if (!id) return;
  await nextTick();
  const input = document.querySelector<HTMLInputElement>(
    `[data-task-id="${id}"] input`,
  );
  input?.focus();
}

function removeTask(taskId: string): void {
  const task = workspace.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const result = workspace.resultForTask(taskId);
  if (result) {
    void ui
      .askConfirm({
        title: '移除这枚图标？',
        message: '删除任务会同时移除当前已生成的结果，此操作无法撤销。',
        confirmLabel: '删除任务',
        tone: 'danger',
      })
      .then((confirmed) => {
        if (confirmed) workspace.removeTask(taskId);
      });
    return;
  }
  workspace.removeTask(taskId);
}
</script>

<template>
  <div class="task-list-shell">
    <div class="task-list-toolbar">
      <p class="task-list-summary">
        一行对应一个图标与一个导出文件。只生成 1 枚时保留一行即可。
      </p>
    </div>

    <TransitionGroup v-if="taskCount > 0" name="task" tag="div" class="task-list">
      <TaskRow
        v-for="(task, index) in workspace.tasks"
        :key="task.id"
        :task="task"
        :index="index"
        :disabled="disabled || workspace.isRunning"
        :error="workspace.validationErrors[task.id]"
        :suffix="suffix"
        @delete="removeTask"
      />
    </TransitionGroup>

    <div v-else class="task-list-empty">
      <span>清单还是空的。</span>
      <span>添加第一枚图标，开始构建你的图标组。</span>
    </div>

    <button
      type="button"
      class="add-task-btn"
      :disabled="disabled || workspace.isRunning || taskCount >= MAX_TASKS"
      @click="addTask"
    >
      <Plus :size="14" />
      <span>{{ taskCount >= MAX_TASKS ? '已达 20 个上限' : '添加图标' }}</span>
      <span v-if="taskCount > 0 && taskCount < MAX_TASKS" class="add-task-btn__hint">
        再添一枚
      </span>
    </button>
  </div>
</template>

<style scoped>
.task-list-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-list-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-list-summary {
  max-width: 330px;
  color: var(--faint);
  font-size: 10.5px;
  line-height: 1.5;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.task-list-empty {
  display: flex;
  flex-direction: column;
  gap: 3px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
  background: rgba(255, 254, 250, 0.45);
  padding: 18px 14px;
  color: var(--muted);
  font-size: 11px;
}

.task-list-empty span:last-child {
  color: var(--faint);
  font-size: 10.5px;
}

.add-task-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 37px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 0 10px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
}

.add-task-btn:hover:not(:disabled) {
  border-color: var(--forest);
  background: rgba(255, 254, 250, 0.65);
  color: var(--forest);
}

.add-task-btn:disabled {
  opacity: 0.45;
}

.add-task-btn__hint {
  margin-left: auto;
  color: var(--faint);
  font-size: 9.5px;
  font-weight: 500;
}

.task-enter-active,
.task-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.task-enter-from,
.task-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.task-move {
  transition: transform 180ms ease;
}

@media (max-width: 520px) {
  .task-list-summary {
    max-width: none;
  }
}
</style>
