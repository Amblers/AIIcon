<script setup lang="ts">
import { AlertCircle, Check, Info, X } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

const { toasts, dismissToast } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-stage" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <button
          v-for="toast in toasts"
          :key="toast.id"
          type="button"
          class="toast"
          :class="`toast--${toast.tone}`"
          @click="dismissToast(toast.id)"
        >
          <span class="toast__icon">
            <Check v-if="toast.tone === 'success'" :size="15" :stroke-width="2.4" />
            <AlertCircle v-else-if="toast.tone === 'error'" :size="15" :stroke-width="2.2" />
            <Info v-else :size="15" :stroke-width="2.2" />
          </span>
          <span class="toast__message">{{ toast.message }}</span>
          <X class="toast__close" :size="13" />
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stage {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(380px, calc(100vw - 30px));
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ink);
  padding: 9px 11px 9px 12px;
  color: rgba(255, 255, 255, 0.92);
  text-align: left;
  box-shadow: 0 18px 40px -16px rgba(13, 23, 17, 0.5);
  pointer-events: auto;
}

.toast__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: var(--acid);
}

.toast--error .toast__icon {
  color: #ffaca1;
}

.toast--info .toast__icon {
  color: #c7d8ff;
}

.toast__message {
  flex: 1;
  font-size: 12.5px;
  line-height: 1.45;
}

.toast__close {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.38);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(9px) scale(0.98);
}

.toast-move {
  transition: transform 220ms ease;
}

@media (max-width: 720px) {
  .toast-stage {
    right: 12px;
    bottom: 12px;
    left: 12px;
    align-items: stretch;
  }
  .toast {
    max-width: none;
  }
}
</style>
