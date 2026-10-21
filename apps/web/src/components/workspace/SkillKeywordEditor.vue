<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, Plus, RotateCcw, Sparkles, X } from 'lucide-vue-next';
import { showToast } from '@/composables/useToast';
import { useWorkspaceStore } from '@/stores/workspace';

defineProps<{ disabled?: boolean }>();
const workspace = useWorkspaceStore();
const input = ref('');
const expanded = ref(false);

const keywords = computed(() => workspace.currentKeywords);
const remaining = computed(() => 8 - keywords.value.length);
const activeSuggestions = computed(
  () => new Set(keywords.value.map((keyword) => keyword.toLowerCase())),
);

function addRaw(raw: string): void {
  if (!raw.trim()) return;
  const pieces = raw
    .split(/[,，]/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  for (const piece of pieces) {
    const result = workspace.addKeyword(piece);
    if (!result.ok && result.message) {
      showToast(result.message, 'info');
      break;
    }
  }
  input.value = '';
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
    event.preventDefault();
    addRaw(input.value);
  } else if (event.key === 'Backspace' && !input.value && keywords.value.length > 0) {
    const last = keywords.value[keywords.value.length - 1];
    if (last) workspace.removeKeyword(last);
  }
}

function toggleSuggestion(keyword: string): void {
  if (activeSuggestions.value.has(keyword.toLowerCase())) {
    workspace.removeKeyword(keyword);
    return;
  }
  const result = workspace.addKeyword(keyword);
  if (!result.ok && result.message) showToast(result.message, 'info');
}

function reset(): void {
  workspace.resetKeywords();
}
</script>

<template>
  <div class="skill-editor" :class="{ 'skill-editor--disabled': disabled }">
    <div class="skill-editor__surface">
      <div class="skill-editor__topline">
        <span class="skill-editor__skill">
          <Sparkles :size="12" />
          Skill · {{ workspace.currentTemplate.name }}
        </span>
        <span class="skill-editor__count">{{ keywords.length }} / 8</span>
      </div>

      <div class="tag-input" :class="{ 'tag-input--disabled': disabled }">
        <span v-for="keyword in keywords" :key="keyword" class="tag">
          {{ keyword }}
          <button
            type="button"
            class="tag__remove"
            :disabled="disabled"
            :aria-label="`移除关键词 ${keyword}`"
            @click="workspace.removeKeyword(keyword)"
          >
            <X :size="10" :stroke-width="2.6" />
          </button>
        </span>
        <input
          v-model="input"
          type="text"
          class="tag-input__field"
          :disabled="disabled || remaining <= 0"
          :placeholder="keywords.length ? '继续添加…' : '输入风格关键词，回车添加'"
          maxlength="20"
          @keydown="onKeydown"
          @blur="addRaw(input)"
        />
      </div>

      <div class="suggestion-row">
        <span class="suggestion-row__label">推荐</span>
        <div class="suggestion-list">
          <button
            v-for="keyword in workspace.currentTemplate.suggestedKeywords"
            :key="keyword"
            type="button"
            class="chip chip--mini"
            :class="{ 'chip--active': activeSuggestions.has(keyword.toLowerCase()) }"
            :disabled="disabled"
            @click="toggleSuggestion(keyword)"
          >
            <Plus v-if="!activeSuggestions.has(keyword.toLowerCase())" :size="10" />
            <span>{{ keyword }}</span>
          </button>
        </div>
      </div>

      <div class="skill-editor__footer">
        <button
          type="button"
          class="rules-toggle"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          <span>查看模板 Skill 规则</span>
          <ChevronDown :size="12" :class="{ 'rules-toggle__chevron--open': expanded }" />
        </button>
        <button
          v-if="keywords.length > 0"
          type="button"
          class="reset-link"
          :disabled="disabled"
          @click="reset"
        >
          <RotateCcw :size="11" />
          恢复默认
        </button>
      </div>

      <Transition name="rules">
        <div v-if="expanded" class="rules-panel">
          <div class="rules-group">
            <span class="rules-label">视觉规则</span>
            <ul>
              <li v-for="rule in workspace.currentTemplate.coreRules" :key="rule">{{ rule }}</li>
            </ul>
          </div>
          <div class="rules-group rules-group--negative">
            <span class="rules-label">禁止项</span>
            <ul>
              <li v-for="rule in workspace.currentTemplate.negativeRules" :key="rule">{{ rule }}</li>
            </ul>
          </div>
        </div>
      </Transition>
    </div>
    <p class="skill-editor__hint">
      关键词只影响造型与细节，不会覆盖模板、颜色、画布或安全约束。
    </p>
  </div>
</template>

<style scoped>
.skill-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-editor--disabled {
  opacity: 0.66;
}

.skill-editor__surface {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 11px 12px 10px;
}

.skill-editor__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.skill-editor__skill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--forest);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.skill-editor__count {
  color: var(--faint);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.tag-input {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  padding: 5px 6px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.tag-input:focus-within {
  border-color: var(--forest);
  box-shadow: 0 0 0 3px rgba(30, 91, 71, 0.09);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 25px;
  border-radius: 6px;
  background: var(--forest-soft);
  padding: 0 5px 0 8px;
  color: var(--forest-deep);
  font-size: 11px;
  font-weight: 600;
}

.tag__remove {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--forest);
  padding: 0;
}

.tag__remove:hover:not(:disabled) {
  background: rgba(30, 91, 71, 0.12);
}

.tag-input__field {
  min-width: 110px;
  flex: 1;
  height: 27px;
  border: 0;
  background: transparent;
  padding: 0 3px;
  font-size: 12px;
  box-shadow: none;
}

.tag-input__field:focus {
  border: 0;
  box-shadow: none;
}

.suggestion-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 9px;
}

.suggestion-row__label {
  flex: 0 0 auto;
  padding-top: 6px;
  color: var(--faint);
  font-size: 10px;
  font-weight: 650;
}

.suggestion-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chip--mini {
  min-height: 25px;
  gap: 4px;
  padding: 0 8px;
  font-size: 10.5px;
}

.skill-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.rules-toggle,
.reset-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 2px 0;
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 550;
}

.rules-toggle:hover,
.reset-link:hover {
  color: var(--ink);
}

.rules-toggle svg {
  transition: transform 180ms ease;
}

.rules-toggle__chevron--open {
  transform: rotate(180deg);
}

.reset-link {
  color: var(--forest);
}

.rules-panel {
  display: grid;
  gap: 11px;
  margin-top: 10px;
  border-top: 1px solid var(--line);
  padding-top: 11px;
}

.rules-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rules-label {
  color: var(--forest);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.rules-group--negative .rules-label {
  color: var(--warning);
}

.rules-group ul {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rules-group li {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.55;
}

.rules-group li::before {
  content: "·";
  margin-right: 5px;
  color: var(--line-strong);
}

.skill-editor__hint {
  color: var(--faint);
  font-size: 10.5px;
  line-height: 1.5;
}

.rules-enter-active,
.rules-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.rules-enter-from,
.rules-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
