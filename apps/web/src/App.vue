<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Layers, Sparkles } from 'lucide-vue-next';
import AppHeader from '@/components/layout/AppHeader.vue';
import SectionHead from '@/components/SectionHead.vue';
import SettingsDialog from '@/components/settings/SettingsDialog.vue';
import ConfirmGenerateDialog from '@/components/workspace/ConfirmGenerateDialog.vue';
import GenerateBar from '@/components/workspace/GenerateBar.vue';
import SkillKeywordEditor from '@/components/workspace/SkillKeywordEditor.vue';
import StyleControls from '@/components/workspace/StyleControls.vue';
import TaskList from '@/components/workspace/TaskList.vue';
import TemplatePicker from '@/components/workspace/TemplatePicker.vue';
import ResultStage from '@/components/results/ResultStage.vue';
import ResultDetailDialog from '@/components/results/ResultDetailDialog.vue';
import ActionConfirmDialog from '@/components/ui/ActionConfirmDialog.vue';
import ToastHost from '@/components/ui/ToastHost.vue';
import { useConfigStore } from '@/stores/config';
import { useWorkspaceStore } from '@/stores/workspace';
import { useDraftPersistence } from '@/composables/useDraftPersistence';

const config = useConfigStore();
const workspace = useWorkspaceStore();
useDraftPersistence();

const taskCountLabel = computed(() => `${workspace.tasks.length} / 20`);

onMounted(() => {
  void config.load();
});
</script>

<template>
  <div class="app-shell">
    <AppHeader />

    <main class="studio">
      <aside class="studio-panel">
        <div class="panel-scroll">
          <div class="panel-lede">
            <span class="eyebrow">
              <Sparkles :size="11" />
              AI VECTOR WORKBENCH
            </span>
            <p>
              选择一种视觉语气，写下图标的含义。<em>其余交给 DeepSeek。</em>
            </p>
          </div>

          <section class="panel-section">
            <SectionHead
              index="01"
              title="风格模板"
              hint="先决定图标如何被看见。"
            >
              <template #meta>
                <span class="meta-tag">{{ workspace.currentTemplate.name }}</span>
              </template>
            </SectionHead>
            <TemplatePicker :disabled="workspace.isRunning" />
          </section>

          <section class="panel-section">
            <SectionHead
              index="02"
              title="生成清单"
              hint="一行一枚图标，文件名可自由编辑。"
            >
              <template #meta>
                <span class="meta-tag meta-tag--mono">{{ taskCountLabel }}</span>
              </template>
            </SectionHead>
            <TaskList :disabled="workspace.isRunning" />
          </section>

          <section class="panel-section">
            <SectionHead
              index="03"
              title="风格微调"
              hint="用几个词，把视觉语气调准。"
            >
              <template #meta>
                <span class="meta-tag meta-tag--mono">SKILL</span>
              </template>
            </SectionHead>
            <SkillKeywordEditor :disabled="workspace.isRunning" />
          </section>

          <section class="panel-section">
            <SectionHead
              index="04"
              title="色彩与形状"
              hint="留白交给 AI，也可以完全掌控。"
            >
              <template #meta>
                <span class="mini-swatches" aria-hidden="true">
                  <span
                    class="mini-swatch"
                    :class="{ 'mini-swatch--auto': !workspace.primaryColor }"
                    :style="{ backgroundColor: workspace.primaryColor ?? '#1E5B47' }"
                  />
                  <span
                    v-if="workspace.supportsBackground"
                    class="mini-swatch"
                    :class="{ 'mini-swatch--auto': !workspace.backgroundColor }"
                    :style="{ backgroundColor: workspace.backgroundColor ?? '#DDF06E' }"
                  />
                  <span v-else class="mini-swatch mini-swatch--transparent" />
                </span>
              </template>
            </SectionHead>
            <StyleControls :disabled="workspace.isRunning" />
          </section>

          <div class="panel-end">
            <Layers :size="12" />
            <span>Structured SVG · Safe Rendering · Batch Export</span>
          </div>
        </div>

        <GenerateBar />
      </aside>

      <ResultStage />
    </main>

    <SettingsDialog />
    <ConfirmGenerateDialog />
    <ResultDetailDialog />
    <ActionConfirmDialog />
    <ToastHost />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: var(--paper);
}

.studio {
  display: grid;
  grid-template-columns: 468px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}

.studio-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: var(--surface-soft);
}

.panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 24px 22px;
}

.panel-lede {
  margin-bottom: 27px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 20px;
}

.panel-lede p {
  max-width: 360px;
  margin-top: 7px;
  color: var(--ink-soft);
  font-family: var(--font-display);
  font-size: 23px;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.panel-lede em {
  color: var(--forest);
  font-weight: 400;
}

.panel-section {
  margin-bottom: 27px;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  min-height: 21px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  padding: 0 7px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.meta-tag--mono {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8px;
  letter-spacing: 0.04em;
}

.mini-swatches {
  display: flex;
  align-items: center;
  gap: 3px;
}

.mini-swatch {
  position: relative;
  display: inline-block;
  width: 17px;
  height: 17px;
  border: 1px solid rgba(23, 33, 27, 0.12);
  border-radius: 5px;
}

.mini-swatch--auto::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 3px;
  background: linear-gradient(
    135deg,
    transparent 42%,
    rgba(255, 255, 255, 0.85) 42% 58%,
    transparent 58%
  );
}

.mini-swatch--transparent {
  background-image: linear-gradient(45deg, var(--line) 25%, transparent 25% 75%, var(--line) 75%);
  background-size: 5px 5px;
  background-color: var(--surface);
}

.panel-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 29px;
  padding-bottom: 6px;
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 7.5px;
  letter-spacing: 0.06em;
  text-align: center;
}

.panel-end svg {
  color: var(--forest);
  opacity: 0.55;
}

@media (max-width: 1240px) {
  .studio {
    grid-template-columns: 430px minmax(0, 1fr);
  }
  .panel-scroll {
    padding: 21px 20px;
  }
}

@media (max-width: 1024px) {
  .app-shell {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .studio {
    display: block;
  }
  .studio-panel {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .panel-scroll {
    overflow: visible;
  }
  .studio-panel {
    position: relative;
  }
}

@media (max-width: 620px) {
  .panel-scroll {
    padding: 19px 16px;
  }
  .panel-lede p {
    font-size: 21px;
  }
}
</style>
