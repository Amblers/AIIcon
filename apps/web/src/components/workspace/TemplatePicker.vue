<script setup lang="ts">
import { computed } from 'vue';
import { Check } from 'lucide-vue-next';
import { TEMPLATES, type TemplateId } from '@aiicon/shared';
import TemplateGlyph from '@/components/TemplateGlyph.vue';
import { useWorkspaceStore } from '@/stores/workspace';

defineProps<{ disabled?: boolean }>();
const workspace = useWorkspaceStore();

const basicTemplates = computed(() => TEMPLATES.filter((template) => template.group === 'basic'));
const backgroundTemplates = computed(() =>
  TEMPLATES.filter((template) => template.group === 'background'),
);

function select(templateId: TemplateId): void {
  workspace.setTemplate(templateId);
}
</script>

<template>
  <div class="template-picker" :class="{ 'template-picker--disabled': disabled }">
    <div class="template-group-label">
      <span>基础图标</span>
      <span class="template-group-label__line" />
    </div>
    <div class="template-grid">
      <button
        v-for="template in basicTemplates"
        :key="template.id"
        type="button"
        class="template-card"
        :class="{ 'template-card--active': workspace.templateId === template.id }"
        :aria-pressed="workspace.templateId === template.id"
        :disabled="disabled"
        @click="select(template.id)"
      >
        <span class="template-card__preview">
          <TemplateGlyph :template-id="template.id" :size="38" />
        </span>
        <span class="template-card__copy">
          <span class="template-card__name">{{ template.name }}</span>
          <span class="template-card__tagline">{{ template.tagline }}</span>
        </span>
        <span v-if="workspace.templateId === template.id" class="template-card__check">
          <Check :size="11" :stroke-width="3" />
        </span>
      </button>
    </div>

    <div class="template-group-label template-group-label--second">
      <span>背景图标</span>
      <span class="template-group-label__line" />
    </div>
    <div class="template-grid template-grid--three">
      <button
        v-for="template in backgroundTemplates"
        :key="template.id"
        type="button"
        class="template-card template-card--compact"
        :class="{ 'template-card--active': workspace.templateId === template.id }"
        :aria-pressed="workspace.templateId === template.id"
        :disabled="disabled"
        @click="select(template.id)"
      >
        <span class="template-card__preview template-card__preview--compact">
          <TemplateGlyph :template-id="template.id" :size="34" />
        </span>
        <span class="template-card__copy">
          <span class="template-card__name">{{ template.shortName }}</span>
        </span>
        <span v-if="workspace.templateId === template.id" class="template-card__check">
          <Check :size="10" :stroke-width="3" />
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.template-picker {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.template-picker--disabled {
  opacity: 0.62;
}

.template-group-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.template-group-label--second {
  margin-top: 6px;
}

.template-group-label__line {
  height: 1px;
  flex: 1;
  background: var(--line);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.template-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.template-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 67px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 10px;
  text-align: left;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease,
    box-shadow 160ms ease;
}

.template-card:hover:not(:disabled) {
  border-color: var(--line-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.template-card--active {
  border-color: var(--forest);
  background: #fbfdf9;
  box-shadow: 0 0 0 1px var(--forest) inset;
}

.template-card:disabled {
  cursor: default;
}

.template-card__preview {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  flex: 0 0 auto;
}

.template-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.template-card__name {
  overflow: hidden;
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 680;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__tagline {
  overflow: hidden;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__check {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--forest);
  color: #fff;
}

.template-card--compact {
  min-height: 76px;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 8px;
}

.template-card--compact .template-card__preview {
  width: 31px;
  height: 31px;
}

.template-card--compact .template-card__name {
  font-size: 11.5px;
  max-width: 100%;
}

.template-card--compact .template-card__check {
  top: 6px;
  right: 6px;
}

@media (max-width: 900px) {
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .template-grid--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .template-card {
    padding: 8px;
  }
  .template-card__preview {
    width: 32px;
    height: 32px;
  }
  .template-card__tagline {
    display: none;
  }
  .template-card__name {
    font-size: 11.5px;
  }
}
</style>
