<script setup lang="ts">
import { computed } from 'vue';
import BaseModal from './BaseModal.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const open = computed({
  get: () => Boolean(ui.confirmation),
  set: (value: boolean) => {
    if (!value) ui.answerConfirm(false);
  },
});

const current = computed(() => ui.confirmation);

function confirm(): void {
  ui.answerConfirm(true);
}
</script>

<template>
  <BaseModal
    v-model="open"
    :title="current?.title ?? '请确认'"
    width="440px"
  >
    <p class="confirm-message">{{ current?.message }}</p>
    <template #footer>
      <button type="button" class="btn btn--ghost" @click="ui.answerConfirm(false)">
        {{ current?.cancelLabel ?? '取消' }}
      </button>
      <button
        type="button"
        class="btn"
        :class="current?.tone === 'danger' ? 'btn--danger' : 'btn--primary'"
        @click="confirm"
      >
        {{ current?.confirmLabel ?? '确认' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-message {
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.65;
}
</style>
