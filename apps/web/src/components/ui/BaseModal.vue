<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    subtitle?: string;
    width?: string;
    closeDisabled?: boolean;
  }>(),
  {
    title: '',
    subtitle: '',
    width: '560px',
    closeDisabled: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const panel = ref<HTMLElement | null>(null);
const titleId = useId();
let previousFocus: HTMLElement | null = null;

function close(): void {
  if (props.closeDisabled) return;
  emit('update:modelValue', false);
}

function onBackdrop(): void {
  close();
}

function focusableElements(): HTMLElement[] {
  if (!panel.value) return [];
  return Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

async function activate(): Promise<void> {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKeydown);
  await nextTick();
  const focusable = focusableElements();
  const preferred = panel.value?.querySelector<HTMLElement>('[autofocus]');
  (preferred ?? focusable[0] ?? panel.value)?.focus();
}

function deactivate(): void {
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onKeydown);
  previousFocus?.focus?.();
  previousFocus = null;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = focusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void activate();
    else deactivate();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-backdrop"
        role="presentation"
        @mousedown.self="onBackdrop"
      >
        <section
          ref="panel"
          class="modal-panel"
          :class="{ 'modal-panel--wide': width === 'wide' }"
          :style="{ '--modal-width': width === 'wide' ? '1040px' : width }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
        >
          <header v-if="title || $slots.header" class="modal-head">
            <slot name="header">
              <div>
                <h2 :id="titleId" class="modal-title">{{ title }}</h2>
                <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
              </div>
            </slot>
            <button
              type="button"
              class="icon-btn modal-close"
              :disabled="closeDisabled"
              aria-label="关闭"
              @click="close"
            >
              <X :size="17" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(19, 27, 22, 0.38);
  backdrop-filter: blur(5px);
  overflow-y: auto;
}

.modal-panel {
  width: min(var(--modal-width), 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: 0 36px 100px -28px rgba(16, 30, 22, 0.46);
  overflow: hidden;
  outline: none;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22px;
  padding: 25px 26px 18px;
  border-bottom: 1px solid var(--line);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.modal-subtitle {
  margin-top: 5px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.55;
}

.modal-close {
  flex: 0 0 auto;
  margin-top: -4px;
  margin-right: -5px;
}

.modal-body {
  min-height: 0;
  padding: 23px 26px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 17px 26px 21px;
  border-top: 1px solid var(--line);
  background: var(--surface-soft);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}

@media (max-width: 720px) {
  .modal-backdrop {
    padding: 12px;
    align-items: end;
  }
  .modal-panel {
    max-height: calc(100vh - 24px);
    border-radius: 20px;
  }
  .modal-head {
    padding: 20px 19px 15px;
  }
  .modal-body {
    padding: 19px;
  }
  .modal-footer {
    padding: 15px 19px 18px;
  }
  .modal-title {
    font-size: 23px;
  }
}
</style>
