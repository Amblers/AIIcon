<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, Sparkles } from 'lucide-vue-next';
import { showToast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import BaseModal from '@/components/ui/BaseModal.vue';
import TemplateGlyph from '@/components/TemplateGlyph.vue';

const workspace = useWorkspaceStore();
const config = useConfigStore();
const ui = useUiStore();

const open = computed({
  get: () => ui.generateConfirmOpen,
  set: (value: boolean) => {
    if (value) ui.openGenerateConfirm();
    else ui.closeGenerateConfirm();
  },
});

const count = computed(() => workspace.activeTasks.length);
const maxCalls = computed(() => count.value * 2);
const primaryLabel = computed(() => workspace.primaryColor ?? 'AI 自动');
const backgroundLabel = computed(() => {
  if (!workspace.supportsBackground) return '透明';
  return workspace.backgroundColor ?? 'AI 自动';
});

async function confirm(): Promise<void> {
  ui.closeGenerateConfirm();
  const result = await workspace.startGeneration();
  if (!result.ok) {
    showToast(result.message ?? '未能开始生成', 'error');
  }
}
</script>

<template>
  <BaseModal
    v-model="open"
    title="确认生成"
    subtitle="检查本次生成批次，确认后会开始消耗 DeepSeek 请求额度。"
    width="540px"
  >
    <div class="confirm-summary">
      <div class="confirm-visual">
        <TemplateGlyph :template-id="workspace.templateId" :size="66" />
      </div>
      <div class="confirm-copy">
        <span class="eyebrow">BATCH SUMMARY</span>
        <h3>{{ count }} 枚图标</h3>
        <p>{{ workspace.currentTemplate.description }}</p>
      </div>
      <span class="confirm-count">{{ count }}</span>
    </div>

    <dl class="confirm-grid">
      <div>
        <dt>模型</dt>
        <dd>{{ config.model }}</dd>
      </div>
      <div>
        <dt>模板</dt>
        <dd>{{ workspace.currentTemplate.name }}</dd>
      </div>
      <div>
        <dt>主色</dt>
        <dd class="confirm-color">
          <span
            class="confirm-color__dot"
            :style="{ backgroundColor: workspace.primaryColor ?? '#1E5B47' }"
          />
          {{ primaryLabel }}
        </dd>
      </div>
      <div>
        <dt>背景</dt>
        <dd class="confirm-color">
          <span
            v-if="workspace.supportsBackground"
            class="confirm-color__dot"
            :style="{ backgroundColor: workspace.backgroundColor ?? '#DDF06E' }"
          />
          <span v-else class="confirm-color__transparent" />
          {{ backgroundLabel }}
        </dd>
      </div>
      <div>
        <dt>微调关键词</dt>
        <dd>{{ workspace.currentKeywords.length }} 个</dd>
      </div>
      <div>
        <dt>最大模型调用</dt>
        <dd>{{ maxCalls }} 次</dd>
      </div>
    </dl>

    <div class="confirm-notice">
      <Sparkles :size="14" />
      <p>
        图标内容会发送至 DeepSeek。每枚图标最多调用 2 次模型（首次生成 + 一次自动修复），
        失败项不会阻塞其他图标。
      </p>
    </div>

    <template #footer>
      <button type="button" class="btn btn--ghost" @click="open = false">返回调整</button>
      <button type="button" class="btn btn--primary" :disabled="count === 0" @click="confirm">
        确认生成 {{ count }} 枚
        <ArrowRight :size="15" />
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-summary {
  display: flex;
  align-items: center;
  gap: 15px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  padding: 14px;
}

.confirm-visual {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  flex: 0 0 auto;
  border-radius: 16px;
  background: var(--paper);
}

.confirm-copy {
  min-width: 0;
  flex: 1;
}

.confirm-copy h3 {
  margin-top: 3px;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.confirm-copy p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.confirm-count {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-family: var(--font-display);
  font-size: 17px;
}

.confirm-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 16px 0 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.confirm-grid > div {
  padding: 11px 13px;
  border-bottom: 1px solid var(--line);
}

.confirm-grid > div:nth-child(odd) {
  border-right: 1px solid var(--line);
}

.confirm-grid > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.confirm-grid dt {
  color: var(--faint);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.confirm-grid dd {
  margin: 3px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}

.confirm-color {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 10.5px !important;
}

.confirm-color__dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid rgba(23, 33, 27, 0.12);
  border-radius: 4px;
}

.confirm-color__transparent {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background-image: linear-gradient(45deg, var(--line) 25%, transparent 25% 75%, var(--line) 75%);
  background-size: 4px 4px;
}

.confirm-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  border-radius: var(--radius-sm);
  background: var(--acid-soft);
  padding: 10px 11px;
  color: #5e641d;
}

.confirm-notice svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.confirm-notice p {
  font-size: 10.5px;
  line-height: 1.55;
}
</style>
