<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Sparkles } from 'lucide-vue-next';
import { contrastRatio } from '@aiicon/shared';
import ColorField from './ColorField.vue';
import RadiusField from './RadiusField.vue';
import { useWorkspaceStore } from '@/stores/workspace';

defineProps<{ disabled?: boolean }>();
const workspace = useWorkspaceStore();

const contrast = computed(() => {
  if (!workspace.supportsBackground) return null;
  if (!workspace.primaryColor || !workspace.backgroundColor) return null;
  const ratio = contrastRatio(workspace.primaryColor, workspace.backgroundColor);
  return {
    ratio,
    low: ratio < 3,
  };
});

const backgroundHint = computed(() =>
  workspace.supportsBackground ? '不设置则由 AI 规划' : '',
);
</script>

<template>
  <div class="style-controls" :class="{ 'style-controls--disabled': disabled }">
    <div class="style-controls__colors">
      <ColorField
        label="图标主色"
        hint="用于图标主体，不设置则由 AI 规划"
        fallback="#1E5B47"
        :model-value="workspace.primaryColor"
        :disabled="disabled"
        @update:model-value="workspace.setPrimaryColor"
      />
      <div class="style-controls__divider" />
      <ColorField
        label="背景底色"
        :hint="backgroundHint || '当前模板使用透明背景'"
        fallback="#DDF06E"
        :model-value="workspace.backgroundColor"
        :disabled="disabled || !workspace.supportsBackground"
        :disabled-reason="workspace.supportsBackground ? '' : '透明背景模板'"
        @update:model-value="workspace.setBackgroundColor"
      />
    </div>

    <RadiusField
      v-if="workspace.supportsRadius"
      :model-value="workspace.roundedRadiusPx"
      :disabled="disabled"
      @update:model-value="workspace.setRadius"
    />

    <div v-if="contrast?.low" class="contrast-warning">
      <AlertTriangle :size="13" />
      <span>
        主色与背景对比度约为 {{ contrast.ratio.toFixed(1) }}:1，低于 3:1，缩小后可能识别困难。
      </span>
    </div>

    <div class="style-note">
      <Sparkles :size="12" />
      <span>
        {{ workspace.supportsBackground
          ? '未指定的颜色由 AI 结合语义与对比度规划。'
          : '基础模板保持透明背景；多色模板的辅助色由 AI 规划。' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.style-controls {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 4px 13px 12px;
}

.style-controls--disabled {
  opacity: 0.76;
}

.style-controls__colors {
  display: flex;
  flex-direction: column;
}

.style-controls__divider {
  height: 1px;
  background: var(--line);
}

.contrast-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 9px;
  border-radius: 7px;
  background: var(--warning-soft);
  padding: 7px 8px;
  color: var(--warning);
  font-size: 10.5px;
  line-height: 1.45;
}

.contrast-warning svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.style-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  border-top: 1px dashed var(--line);
  margin-top: 9px;
  padding-top: 9px;
  color: var(--faint);
  font-size: 10px;
  line-height: 1.5;
}

.style-note svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--forest);
}
</style>
