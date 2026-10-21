import { reactive } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const toasts = reactive<ToastItem[]>([]);
let nextId = 1;
const timers = new Map<number, number>();

function dismissToast(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) toasts.splice(index, 1);
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
}

export function showToast(
  message: string,
  tone: ToastTone = 'info',
  duration = 3400,
): number {
  const id = nextId++;
  toasts.push({ id, message, tone });
  if (duration > 0) {
    timers.set(id, window.setTimeout(() => dismissToast(id), duration));
  }
  return id;
}

export function useToast() {
  return {
    toasts,
    showToast,
    dismissToast,
  };
}
