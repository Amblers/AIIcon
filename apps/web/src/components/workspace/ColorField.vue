<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { Lock, Sparkles } from 'lucide-vue-next';
import { normalizeHex } from '@aiicon/shared';

const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    modelValue: string | null;
    disabled?: boolean;
    disabledReason?: string;
    fallback?: string;
  }>(),
  {
    hint: '',
    disabled: false,
    disabledReason: '',
    fallback: '#1E5B47',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const inputId = useId();
const colorInput = ref<HTMLInputElement | null>(null);
const hexDraft = ref(props.modelValue ?? '');
const invalid = ref(false);

const swatchColor = computed(() => props.modelValue ?? props.fallback);
const isAuto = computed(() => !props.modelValue);

watch(
  () => props.modelValue,
  (value) => {
    hexDraft.value = value ?? '';
    invalid.value = false;
  },
);

function setAuto(): void {
  if (props.disabled) return;
  invalid.value = false;
  hexDraft.value = '';
  emit('update:modelValue', null);
}

function setFromPicker(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  const normalized = normalizeHex(value);
  if (!normalized) return;
  hexDraft.value = normalized;
  invalid.value = false;
  emit('update:modelValue', normalized);
}

function commitHex(): void {
  if (props.disabled) return;
  const value = hexDraft.value.trim();
  if (!value) {
    emit('update:modelValue', null);
    invalid.value = false;
    return;
  }
  const normalized = normalizeHex(value);
  if (!normalized) {
    invalid.value = true;
    return;
  }
  invalid.value = false;
  hexDraft.value = normalized;
  emit('update:modelValue', normalized);
}

function onHexInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  hexDraft.value = value;
  const normalized = normalizeHex(value);
  invalid.value = false;
  if (normalized) emit('update:modelValue', normalized);
}
</script>

<template>
  <div class="color-field" :class="{ 'color-field--disabled': disabled }">
    <div class="color-field__label-group">
      <label class="color-field__label" :for="inputId">{{ label }}</label>
      <p v-if="hint" class="color-field__hint">{{ hint }}</p>
    </div>

    <div v-if="disabled" class="color-field__disabled">
      <Lock :size="12" />
      <span>{{ disabledReason || '当前设置不可用' }}</span>
    </div>

    <div v-else class="color-field__control">
      <label
        class="color-swatch"
        :class="{ 'color-swatch--auto': isAuto }"
        :style="{ backgroundColor: swatchColor }"
        :title="isAuto ? '选择一个颜色' : `当前颜色 ${modelValue}`"
      >
        <input
          ref="colorInput"
          type="color"
          class="color-swatch__input"
          :value="swatchColor"
          :aria-label="`${label}取色器`"
          @input="setFromPicker"
        />
        <span v-if="isAuto" class="color-swatch__spark">
          <Sparkles :size="12" />
        </span>
      </label>

      <div class="color-field__value">
        <input
          :id="inputId"
          :value="hexDraft"
          type="text"
          class="hex-input"
          :class="{ 'hex-input--invalid': invalid, 'hex-input--auto': isAuto }"
          :placeholder="isAuto ? 'AI 自动' : '#RRGGBB'"
          maxlength="7"
          spellcheck="false"
          autocomplete="off"
          aria-label="HEX 色值；留空由 AI 规划"
          title="输入 HEX 色值即可指定颜色；留空由 AI 规划"
          @input="onHexInput"
          @blur="commitHex"
          @keydown.enter.prevent="commitHex"
        />
        <span v-if="invalid" class="color-field__error">格式应为 #RRGGBB</span>
      </div>

      <button
        type="button"
        class="color-auto-btn"
        :class="{ 'color-auto-btn--active': isAuto }"
        :aria-pressed="isAuto"
        @click="setAuto"
      >
        自动
      </button>
    </div>
  </div>
</template>

<style scoped>
.color-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  min-height: 58px;
  padding: 8px 0;
}

.color-field__label-group {
  min-width: 0;
}

.color-field__label {
  display: block;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 650;
}

.color-field__hint {
  margin-top: 2px;
  color: var(--faint);
  font-size: 10.5px;
  line-height: 1.4;
}

.color-field__control {
  display: flex;
  align-items: center;
  gap: 7px;
}

.color-swatch {
  position: relative;
  display: block;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border: 1px solid rgba(23, 33, 27, 0.12);
  border-radius: 8px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  overflow: hidden;
}

.color-swatch--auto {
  background-image: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.68) 0 42%,
    transparent 42% 100%
  );
}

.color-swatch__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: 0;
  padding: 0;
}

.color-swatch__spark {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.94);
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.color-field__value {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 90px;
}

.hex-input {
  width: 84px;
  height: 29px;
  border-radius: 7px;
  background: var(--surface-soft);
  padding: 0 7px;
  color: var(--ink-soft);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 10.5px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.hex-input--auto {
  font-family: var(--font-ui);
  font-size: 10.5px;
  letter-spacing: 0;
  text-transform: none;
}

.hex-input::placeholder {
  color: var(--faint);
}

.hex-input--invalid {
  border-color: var(--danger);
}

.color-field__error {
  margin-top: 3px;
  color: var(--danger);
  font-size: 9px;
  white-space: nowrap;
}

.color-auto-btn {
  min-height: 27px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  padding: 0 8px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

.color-auto-btn:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

.color-auto-btn--active {
  border-color: var(--forest);
  background: var(--forest-soft);
  color: var(--forest);
}

.color-field__disabled {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--faint);
  font-size: 10.5px;
  text-align: right;
}

.color-field--disabled {
  opacity: 0.75;
}

@media (max-width: 520px) {
  .color-field {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .color-field__control {
    justify-content: flex-start;
  }
  .hex-input {
    width: 100px;
  }
}
</style>
