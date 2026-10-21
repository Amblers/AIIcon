<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';

const props = defineProps<{
  modelValue: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const inputId = useId();
const draft = ref(String(props.modelValue));

watch(
  () => props.modelValue,
  (value) => {
    draft.value = String(value);
  },
);

const percent = computed(() => (props.modelValue / 256) * 100);

function update(value: number): void {
  const next = Number.isFinite(value) ? Math.min(256, Math.max(0, Math.round(value))) : 96;
  emit('update:modelValue', next);
}

function onRange(event: Event): void {
  update(Number((event.target as HTMLInputElement).value));
}

function onNumberInput(event: Event): void {
  draft.value = (event.target as HTMLInputElement).value;
  const value = Number(draft.value);
  if (Number.isFinite(value)) update(value);
}

function onNumberBlur(): void {
  const value = Number(draft.value);
  if (!Number.isFinite(value)) {
    draft.value = String(props.modelValue);
    return;
  }
  update(value);
}
</script>

<template>
  <div class="radius-field">
    <div class="radius-field__head">
      <label :for="inputId" class="radius-field__label">背景圆角</label>
      <div class="radius-number">
        <input
          :id="inputId"
          :value="draft"
          type="number"
          min="0"
          max="256"
          step="1"
          :disabled="disabled"
          aria-label="背景圆角像素"
          @input="onNumberInput"
          @blur="onNumberBlur"
        />
        <span>px</span>
      </div>
    </div>
    <input
      type="range"
      class="radius-range"
      :style="{ '--range-fill': `${percent}%` }"
      :value="modelValue"
      min="0"
      max="256"
      step="1"
      :disabled="disabled"
      aria-label="调整背景圆角"
      @input="onRange"
    />
    <div class="radius-scale">
      <span>0</span>
      <span>96</span>
      <span>256</span>
    </div>
  </div>
</template>

<style scoped>
.radius-field {
  border-top: 1px solid var(--line);
  padding-top: 13px;
  margin-top: 4px;
}

.radius-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.radius-field__label {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 650;
}

.radius-number {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-soft);
  padding-right: 7px;
  color: var(--muted);
  font-size: 10px;
}

.radius-number input {
  width: 52px;
  height: 26px;
  border: 0;
  background: transparent;
  padding: 0 2px 0 8px;
  color: var(--ink-soft);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  box-shadow: none;
  text-align: right;
}

.radius-number input:focus {
  box-shadow: none;
}

.radius-range {
  width: 100%;
  height: 18px;
  margin: 9px 0 1px;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.radius-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 99px;
  background: linear-gradient(
    to right,
    var(--forest) 0 var(--range-fill),
    var(--line) var(--range-fill) 100%
  );
}

.radius-range::-moz-range-track {
  height: 4px;
  border-radius: 99px;
  background: var(--line);
}

.radius-range::-moz-range-progress {
  height: 4px;
  border-radius: 99px;
  background: var(--forest);
}

.radius-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--forest);
  box-shadow: 0 1px 4px rgba(23, 33, 27, 0.25);
}

.radius-range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--forest);
}

.radius-scale {
  display: flex;
  justify-content: space-between;
  color: var(--faint);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
</style>
