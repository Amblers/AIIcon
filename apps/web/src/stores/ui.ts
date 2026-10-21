import { defineStore } from 'pinia';
import { ref } from 'vue';

interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

interface ConfirmationState extends ConfirmActionOptions {
  resolve: (value: boolean) => void;
}

export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false);
  const detailTaskId = ref<string | null>(null);
  const generateConfirmOpen = ref(false);
  const confirmation = ref<ConfirmationState | null>(null);

  function openSettings(): void {
    settingsOpen.value = true;
  }

  function closeSettings(): void {
    settingsOpen.value = false;
  }

  function openDetail(taskId: string): void {
    detailTaskId.value = taskId;
  }

  function closeDetail(): void {
    detailTaskId.value = null;
  }

  function openGenerateConfirm(): void {
    generateConfirmOpen.value = true;
  }

  function closeGenerateConfirm(): void {
    generateConfirmOpen.value = false;
  }

  function askConfirm(options: ConfirmActionOptions): Promise<boolean> {
    if (confirmation.value) {
      confirmation.value.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      confirmation.value = {
        tone: 'default',
        confirmLabel: '确认',
        cancelLabel: '取消',
        ...options,
        resolve,
      };
    });
  }

  function answerConfirm(value: boolean): void {
    const current = confirmation.value;
    if (!current) return;
    confirmation.value = null;
    current.resolve(value);
  }

  return {
    settingsOpen,
    detailTaskId,
    generateConfirmOpen,
    confirmation,
    openSettings,
    closeSettings,
    openDetail,
    closeDetail,
    openGenerateConfirm,
    closeGenerateConfirm,
    askConfirm,
    answerConfirm,
  };
});
