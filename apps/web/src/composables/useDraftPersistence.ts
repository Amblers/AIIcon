import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { showToast } from './useToast';

const STORAGE_KEY = 'aiicon:draft:v1';

export function useDraftPersistence() {
  const workspace = useWorkspaceStore();
  const restored = ref(false);
  let timer: number | null = null;
  let ready = false;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      restored.value = workspace.hydrateDraft(parsed);
    }
  } catch {
    restored.value = false;
  }

  watch(
    () => workspace.draftPayload,
    (payload) => {
      if (!ready) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // Local quota or privacy mode failures must not interrupt the studio.
        }
      }, 450);
    },
    { deep: true, flush: 'post' },
  );

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!workspace.isRunning) return;
    event.preventDefault();
    event.returnValue = '';
  };

  onMounted(() => {
    ready = true;
    window.addEventListener('beforeunload', onBeforeUnload);
    if (restored.value) {
      showToast('已恢复上次编辑的草稿。', 'info');
    }
  });

  onBeforeUnmount(() => {
    if (timer) window.clearTimeout(timer);
    window.removeEventListener('beforeunload', onBeforeUnload);
  });

  return { restored };
}
