<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  ArrowRight,
  Grid2X2,
  Layers,
  LoaderCircle,
  Moon,
  RefreshCw,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-vue-next';
import { showToast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import TemplateGlyph from '@/components/TemplateGlyph.vue';
import ResultCard from './ResultCard.vue';
import ExportBar from './ExportBar.vue';

const workspace = useWorkspaceStore();
const config = useConfigStore();
const ui = useUiStore();
const surface = ref<'checker' | 'light' | 'dark'>('checker');
const stage = ref<HTMLElement | null>(null);

const tasks = computed(() => workspace.displayedTasks);
const successCount = computed(() => workspace.successfulEntries.length);
const failedCount = computed(() => tasks.value.filter((task) => task.status === 'failed').length);
const pendingCount = computed(
  () => tasks.value.filter((task) => task.status === 'queued' || task.status === 'generating').length,
);
const isEmpty = computed(() => tasks.value.length === 0 && !workspace.isRunning);

const surfaceOptions = [
  { value: 'checker', label: '透明棋盘', icon: Grid2X2 },
  { value: 'light', label: '浅色背景', icon: Sun },
  { value: 'dark', label: '深色背景', icon: Moon },
] as const;

async function retryFailed(): Promise<void> {
  if (!config.configured) {
    ui.openSettings();
    return;
  }
  const result = await workspace.retryFailed();
  if (!result.ok && result.message) showToast(result.message, 'info');
}

function askClear(): void {
  void ui
    .askConfirm({
      title: '清空当前结果？',
      message: '这只会移除预览与结果，不会删除左侧的内容和文件名。该操作无法撤销。',
      confirmLabel: '清空结果',
      tone: 'danger',
    })
    .then((confirmed) => {
      if (confirmed) workspace.clearResults();
    });
}

function regenerateAll(): void {
  if (!config.configured) {
    ui.openSettings();
    return;
  }
  const validation = workspace.validate();
  if (!validation.ok) {
    showToast(validation.message ?? '请检查输入', 'error');
    return;
  }
  ui.openGenerateConfirm();
}

watch(
  () => workspace.isRunning,
  async (running) => {
    if (!running) return;
    await nextTick();
    if (window.innerWidth < 1024) {
      stage.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },
);
</script>

<template>
  <section ref="stage" class="stage">
    <header class="stage-head">
      <div class="stage-head__copy">
        <span class="eyebrow">
          <Layers :size="11" />
          WORKSPACE / RESULTS
        </span>
        <div class="stage-title-row">
          <h1>图标画布</h1>
          <span v-if="tasks.length" class="stage-count">{{ successCount }} / {{ tasks.length }}</span>
        </div>
      </div>

      <div class="stage-tools">
        <div class="surface-toggle" role="group" aria-label="预览背景">
          <button
            v-for="option in surfaceOptions"
            :key="option.value"
            type="button"
            class="surface-toggle__item"
            :class="{ 'surface-toggle__item--active': surface === option.value }"
            :aria-label="option.label"
            :aria-pressed="surface === option.value"
            :title="option.label"
            @click="surface = option.value"
          >
            <component :is="option.icon" :size="13" />
          </button>
        </div>

        <button
          v-if="failedCount > 0 && !workspace.isRunning"
          type="button"
          class="btn btn--sm btn--outline stage-retry"
          @click="retryFailed"
        >
          <RefreshCw :size="12" />
          重试失败 {{ failedCount }}
        </button>

        <button
          v-if="workspace.hasResults && !workspace.isRunning"
          type="button"
          class="icon-btn"
          title="清空结果"
          aria-label="清空结果"
          @click="askClear"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </header>

    <div v-if="workspace.isRunning" class="stage-progress" aria-live="polite">
      <span class="stage-progress__spark"><Sparkles :size="13" /></span>
      <span>正在为 {{ workspace.progress.total }} 枚图标绘制风格统一的图形…</span>
      <span class="stage-progress__count">
        已完成 {{ workspace.progress.completed }} / {{ workspace.progress.total }}
      </span>
      <LoaderCircle :size="13" class="spin" />
    </div>

    <div v-if="workspace.hasStaleResults && !workspace.isRunning" class="stale-note">
      <span class="stale-note__dot" />
      <p>部分结果来自较早的设置或内容。已有图稿不会被自动覆盖。</p>
      <button type="button" class="stale-note__action" @click="regenerateAll">
        用当前设置重新生成
        <ArrowRight :size="11" />
      </button>
    </div>

    <div v-if="isEmpty" class="empty-stage">
      <div class="empty-art" aria-hidden="true">
        <div class="empty-art__glow" />
        <div class="empty-tile empty-tile--left">
          <TemplateGlyph template-id="circle-bg" :size="50" />
        </div>
        <div class="empty-tile empty-tile--right">
          <TemplateGlyph template-id="multicolor" :size="50" />
        </div>
        <div class="empty-tile empty-tile--main">
          <TemplateGlyph :template-id="workspace.templateId" :size="118" />
        </div>
        <span class="empty-art__orbit empty-art__orbit--one" />
        <span class="empty-art__orbit empty-art__orbit--two" />
      </div>

      <div class="empty-copy">
        <span class="eyebrow">
          <Sparkles :size="11" />
          {{ config.configured ? 'READY TO MAKE' : 'FROM IDEA TO ICON SET' }}
        </span>
        <h2>让每个想法，<br /><em>都有自己的图标。</em></h2>
        <p>
          选一个模板，写下图标的含义。DeepSeek 会按你的风格与颜色，生成可用的矢量图稿。
        </p>
      </div>

      <div class="empty-steps">
        <div class="empty-step">
          <span>01</span>
          <div>
            <strong>选择模板</strong>
            <p>线性、面性或应用图标底。</p>
          </div>
        </div>
        <div class="empty-step">
          <span>02</span>
          <div>
            <strong>填写清单</strong>
            <p>内容与文件名一一对应。</p>
          </div>
        </div>
        <div class="empty-step">
          <span>03</span>
          <div>
            <strong>生成并导出</strong>
            <p>预览后导出 SVG 或 PNG。</p>
          </div>
        </div>
      </div>

      <button
        v-if="!config.configured"
        type="button"
        class="btn btn--primary empty-cta"
        @click="ui.openSettings"
      >
        <Settings2 :size="15" />
        配置 DeepSeek API
        <ArrowRight :size="14" />
      </button>
      <p v-else class="empty-hint">
        <span class="empty-hint__dot" />
        在左侧填写图标内容，然后点击「生成」。
      </p>
    </div>

    <div v-else class="stage-body">
      <div class="results-grid">
        <ResultCard
          v-for="(task, index) in tasks"
          :key="task.id"
          :task="task"
          :result="workspace.resultForTask(task.id)"
          :surface="surface"
          :index="index"
        />
      </div>

      <div v-if="pendingCount > 0" class="pending-note">
        <LoaderCircle :size="12" class="spin" />
        正在处理剩余的 {{ pendingCount }} 枚图标…
      </div>
    </div>

    <ExportBar v-if="workspace.canExport" />

    <footer class="stage-foot">
      <span>AI 生成内容可能存在偏差，导出前请检查图标含义与对比度。</span>
      <span class="stage-foot__brand">AIICON / 2026</span>
    </footer>
  </section>
</template>

<style scoped>
.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  background-color: var(--paper);
  background-image: radial-gradient(rgba(51, 68, 56, 0.08) 0.7px, transparent 0.7px);
  background-size: 18px 18px;
}

.stage-head {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid rgba(206, 199, 184, 0.55);
  background: rgba(243, 240, 232, 0.84);
  padding: 21px 27px 16px;
  backdrop-filter: blur(16px);
}

.stage-head__copy {
  min-width: 0;
}

.stage-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 4px;
}

.stage-title-row h1 {
  font-family: var(--font-display);
  font-size: 31px;
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1;
}

.stage-count {
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
}

.stage-tools {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-top: 4px;
}

.surface-toggle {
  display: flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  padding: 2px;
}

.surface-toggle__item {
  display: grid;
  place-items: center;
  width: 27px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--faint);
}

.surface-toggle__item:hover {
  color: var(--ink);
}

.surface-toggle__item--active {
  background: var(--ink);
  color: #fff;
}

.stage-retry {
  height: 32px;
}

.stage-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 15px 27px 0;
  border: 1px solid rgba(30, 91, 71, 0.15);
  border-radius: 10px;
  background: rgba(255, 254, 250, 0.68);
  padding: 9px 11px;
  color: var(--forest);
  font-size: 10.5px;
  backdrop-filter: blur(6px);
}

.stage-progress__spark {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 7px;
  background: var(--acid-soft);
}

.stage-progress__count {
  margin-left: auto;
  color: var(--muted);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9px;
  white-space: nowrap;
}

.stale-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 11px 27px 0;
  border: 1px solid rgba(153, 100, 24, 0.12);
  border-radius: 8px;
  background: rgba(251, 241, 217, 0.66);
  padding: 7px 9px;
  color: var(--warning);
}

.stale-note__dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--warning);
}

.stale-note p {
  min-width: 0;
  flex: 1;
  font-size: 10px;
  line-height: 1.4;
}

.stale-note__action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--warning);
  font-size: 10px;
  font-weight: 650;
}

.stage-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 22px 27px 30px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}

.pending-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--faint);
  font-size: 10px;
}

.empty-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 550px;
  padding: 40px 34px 44px;
  text-align: center;
}

.empty-art {
  position: relative;
  width: 340px;
  height: 220px;
  margin-bottom: 26px;
}

.empty-art__glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 230px;
  height: 170px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(223, 240, 110, 0.44), transparent 68%);
  filter: blur(14px);
}

.empty-tile {
  position: absolute;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 22px 44px -24px rgba(23, 33, 27, 0.34);
}

.empty-tile--main {
  top: 17px;
  left: 50%;
  width: 160px;
  height: 160px;
  transform: translateX(-50%) rotate(-2deg);
  border-radius: 32px;
  background: #e6e1d3;
  animation: float-main 6s ease-in-out infinite;
}

.empty-tile--left {
  top: 61px;
  left: 15px;
  width: 82px;
  height: 82px;
  transform: rotate(-10deg);
  border-radius: 22px;
  animation: float-left 7s ease-in-out infinite;
}

.empty-tile--right {
  top: 48px;
  right: 10px;
  width: 93px;
  height: 93px;
  transform: rotate(7deg);
  border-radius: 24px;
  animation: float-right 8s ease-in-out infinite;
}

.empty-art__orbit {
  position: absolute;
  border: 1px solid rgba(30, 91, 71, 0.12);
  border-radius: 50%;
  pointer-events: none;
}

.empty-art__orbit--one {
  inset: 1px 20px 0;
  transform: rotate(13deg);
}

.empty-art__orbit--two {
  inset: 21px -2px 14px;
  transform: rotate(-17deg);
  border-color: rgba(41, 88, 232, 0.1);
}

@keyframes float-main {
  0%, 100% { transform: translateX(-50%) translateY(0) rotate(-2deg); }
  50% { transform: translateX(-50%) translateY(-6px) rotate(0deg); }
}

@keyframes float-left {
  0%, 100% { transform: translateY(0) rotate(-10deg); }
  50% { transform: translateY(5px) rotate(-7deg); }
}

@keyframes float-right {
  0%, 100% { transform: translateY(0) rotate(7deg); }
  50% { transform: translateY(-7px) rotate(4deg); }
}

.empty-copy {
  max-width: 560px;
}

.empty-copy h2 {
  margin-top: 9px;
  font-family: var(--font-display);
  font-size: clamp(38px, 4.1vw, 58px);
  font-weight: 500;
  letter-spacing: -0.055em;
  line-height: 1.03;
}

.empty-copy h2 em {
  color: var(--forest);
  font-weight: 400;
}

.empty-copy p {
  max-width: 430px;
  margin: 15px auto 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.75;
}

.empty-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  width: min(560px, 100%);
  margin: 29px 0 24px;
  border-top: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
  text-align: left;
}

.empty-step {
  display: flex;
  gap: 9px;
  padding: 12px 12px 12px 0;
}

.empty-step + .empty-step {
  border-left: 1px solid var(--line);
  padding-left: 14px;
}

.empty-step > span {
  color: var(--faint);
  font-family: var(--font-display);
  font-size: 10px;
  font-style: italic;
}

.empty-step strong {
  display: block;
  margin-bottom: 2px;
  color: var(--ink-soft);
  font-size: 10.5px;
  font-weight: 650;
}

.empty-step p {
  color: var(--faint);
  font-size: 9.5px;
  line-height: 1.45;
}

.empty-cta {
  min-height: 42px;
}

.empty-cta svg:last-child {
  margin-left: 3px;
  opacity: 0.7;
}

.empty-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 10.5px;
}

.empty-hint__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--forest);
  box-shadow: 0 0 0 3px rgba(30, 91, 71, 0.08);
}

.stage-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: auto;
  padding: 15px 27px 19px;
  color: var(--faint);
  font-size: 9px;
}

.stage-foot__brand {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
}

@media (max-width: 1320px) {
  .results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .stage {
    min-height: 700px;
    height: auto;
  }
  .stage-head {
    position: relative;
  }
  .empty-stage {
    min-height: 620px;
  }
}

@media (max-width: 700px) {
  .stage-head {
    align-items: flex-start;
    padding: 17px 16px 13px;
  }
  .stage-title-row h1 {
    font-size: 27px;
  }
  .stage-tools {
    gap: 5px;
  }
  .surface-toggle {
    display: none;
  }
  .stage-progress,
  .stale-note {
    margin-left: 16px;
    margin-right: 16px;
  }
  .stage-progress {
    flex-wrap: wrap;
  }
  .stage-progress__count {
    margin-left: 0;
  }
  .stage-body {
    padding: 16px;
  }
  .results-grid {
    grid-template-columns: 1fr;
  }
  .empty-stage {
    min-height: 0;
    padding: 30px 18px 40px;
  }
  .empty-art {
    transform: scale(0.82);
    transform-origin: center;
    margin: -10px 0 0;
  }
  .empty-copy h2 {
    font-size: 40px;
  }
  .empty-steps {
    grid-template-columns: 1fr;
    margin: 24px 0 20px;
  }
  .empty-step + .empty-step {
    border-top: 1px solid var(--line);
    border-left: 0;
    padding-left: 0;
  }
  .stage-foot {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px 18px;
  }
  .stage-foot__brand {
    display: none;
  }
}
</style>
