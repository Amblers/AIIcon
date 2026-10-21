<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ArrowRight,
  LoaderCircle,
  Settings2,
  Sparkles,
  Square,
} from 'lucide-vue-next';
import { showToast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';

const workspace = useWorkspaceStore();
const config = useConfigStore();
const ui = useUiStore();
const starting = ref(false);

const count = computed(() => workspace.activeTasks.length);
const canGenerateLabel = computed(() => {
  if (count.value === 0) return '添加图标内容后生成';
  if (count.value === 1) return '生成 1 枚图标';
  return `生成 ${count.value} 枚图标`;
});

const progressPercent = computed(() => {
  if (workspace.progress.total === 0) return 0;
  return Math.round((workspace.progress.completed / workspace.progress.total) * 100);
});

async function focusFirstError(taskId?: string): Promise<void> {
  if (!taskId) return;
  await nextTick();
  const element = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element?.querySelector<HTMLInputElement>('input')?.focus();
}

async function beginSingle(): Promise<void> {
  starting.value = true;
  try {
    const result = await workspace.startGeneration();
    if (!result.ok) {
      showToast(result.message ?? '生成失败', 'error');
      await focusFirstError(result.taskId);
    }
  } finally {
    starting.value = false;
  }
}

async function handlePrimary(): Promise<void> {
  if (!config.configured) {
    ui.openSettings();
    return;
  }
  if (count.value === 0) return;
  if (config.offline) {
    ui.openSettings();
    return;
  }

  const validation = workspace.validate();
  if (!validation.ok) {
    showToast(validation.message ?? '请检查输入内容', 'error');
    await focusFirstError(validation.taskId);
    return;
  }

  if (workspace.activeTasks.length >= 2) {
    ui.openGenerateConfirm();
    return;
  }
  await beginSingle();
}

function cancel(): void {
  workspace.cancelGeneration();
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;
  if (workspace.isRunning || starting.value) return;
  if (
    ui.settingsOpen ||
    ui.generateConfirmOpen ||
    ui.detailTaskId ||
    ui.confirmation
  ) {
    return;
  }
  event.preventDefault();
  void handlePrimary();
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown));
</script>

<template>
  <div class="generate-dock">
    <div v-if="workspace.isRunning" class="run-progress" aria-live="polite">
      <div class="run-progress__top">
        <span class="run-progress__label">
          <LoaderCircle :size="12" class="spin" />
          正在生成 {{ workspace.progress.completed }} / {{ workspace.progress.total }}
        </span>
        <span class="run-progress__pct">{{ progressPercent }}%</span>
      </div>
      <div class="run-progress__track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${progressPercent}%` }" />
      </div>
      <div class="run-progress__meta">
        <span>成功 {{ workspace.progress.succeeded }}</span>
        <span v-if="workspace.progress.failed">失败 {{ workspace.progress.failed }}</span>
        <button type="button" class="run-progress__cancel" @click="cancel">
          <Square :size="10" fill="currentColor" />
          取消生成
        </button>
      </div>
    </div>

    <button
      v-if="workspace.isRunning"
      type="button"
      class="generate-btn generate-btn--running"
      disabled
    >
      <LoaderCircle :size="17" class="spin" />
      <span>批次进行中</span>
      <span class="generate-btn__count">请稍候</span>
    </button>

    <button
      v-else-if="config.loading && !config.hasLoaded"
      type="button"
      class="generate-btn"
      disabled
    >
      <LoaderCircle :size="17" class="spin" />
      <span>连接本地服务…</span>
    </button>

    <button
      v-else-if="!config.configured"
      type="button"
      class="generate-btn generate-btn--config"
      @click="ui.openSettings"
    >
      <Settings2 :size="17" />
      <span>配置 DeepSeek 后开始</span>
      <ArrowRight :size="16" class="generate-btn__arrow" />
    </button>

    <button
      v-else
      type="button"
      class="generate-btn"
      :disabled="count === 0 || starting"
      @click="handlePrimary"
    >
      <Sparkles :size="17" />
      <span>{{ starting ? '准备生成…' : canGenerateLabel }}</span>
      <span v-if="count > 0" class="generate-btn__count">⌘↵</span>
      <ArrowRight v-else :size="16" class="generate-btn__arrow" />
    </button>

    <div class="generate-footnote">
      <span class="generate-footnote__dot" />
      <span v-if="workspace.isRunning">已完成的图标会保留，可继续查看或导出。</span>
      <span v-else-if="!config.configured">API Key 只保存在你的本地服务端，不会进入浏览器存储。</span>
      <span v-else>多枚生成会先确认；每枚图标最多 2 次模型调用。</span>
    </div>
  </div>
</template>

<style scoped>
.generate-dock {
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-top: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(243, 240, 232, 0.92), var(--paper) 45%);
  padding: 13px 22px 17px;
  backdrop-filter: blur(12px);
}

.run-progress {
  border: 1px solid rgba(30, 91, 71, 0.18);
  border-radius: 10px;
  background: #f7fbf8;
  padding: 8px 10px;
}

.run-progress__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.run-progress__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--forest);
  font-size: 10.5px;
  font-weight: 650;
}

.run-progress__pct {
  color: var(--forest);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9px;
}

.run-progress__track {
  height: 3px;
  border-radius: 99px;
  background: rgba(30, 91, 71, 0.12);
  overflow: hidden;
}

.run-progress__track span {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--forest);
  transition: width 300ms ease;
}

.run-progress__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  color: var(--muted);
  font-size: 9.5px;
}

.run-progress__meta span + span::before {
  content: "·";
  margin-right: 10px;
  color: var(--line-strong);
}

.run-progress__cancel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  border: 0;
  background: transparent;
  padding: 1px 0;
  color: var(--danger);
  font-size: 9.5px;
  font-weight: 600;
}

.generate-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 48px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: var(--ink);
  padding: 0 15px;
  color: #fff;
  font-size: 13px;
  font-weight: 680;
  letter-spacing: -0.005em;
  box-shadow: 0 10px 24px -16px rgba(23, 33, 27, 0.9);
  transition: background 160ms ease, transform 160ms ease, box-shadow 160ms ease,
    opacity 160ms ease;
}

.generate-btn:hover:not(:disabled) {
  background: var(--forest-deep);
  transform: translateY(-1px);
  box-shadow: 0 13px 28px -15px rgba(23, 33, 27, 0.9);
}

.generate-btn:disabled {
  opacity: 0.5;
}

.generate-btn--config {
  background: var(--forest);
}

.generate-btn--running {
  background: #eef2ed;
  color: var(--forest);
  box-shadow: none;
}

.generate-btn__count {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.5);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 10px;
  font-weight: 500;
}

.generate-btn--running .generate-btn__count {
  color: var(--muted);
}

.generate-btn__arrow {
  margin-left: auto;
  opacity: 0.6;
}

.generate-footnote {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--faint);
  font-size: 9.5px;
  line-height: 1.4;
  text-align: center;
}

.generate-footnote__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--acid);
  box-shadow: 0 0 0 2px rgba(223, 240, 110, 0.24);
}

@media (max-width: 520px) {
  .generate-dock {
    padding: 12px 16px 15px;
  }
}
</style>
