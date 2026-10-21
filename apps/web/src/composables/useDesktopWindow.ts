import { onMounted, ref } from 'vue';

const api = typeof window !== 'undefined' ? window.aiiconDesktop : undefined;
const isDesktop = Boolean(api?.isDesktop);
const isMaximized = ref(false);
let initialized = false;
let unsubscribe: (() => void) | null = null;

if (isDesktop && typeof document !== 'undefined') {
  document.documentElement.classList.add('is-desktop');
}

function initialize(): void {
  if (initialized || !isDesktop || !api) return;
  initialized = true;
  void api
    .isMaximized()
    .then((maximized) => {
      isMaximized.value = maximized;
    })
    .catch(() => undefined);
  unsubscribe = api.onWindowState((state) => {
    isMaximized.value = state.maximized;
  });
}

export function useDesktopWindow() {
  onMounted(initialize);

  function minimize(): void {
    void api?.minimize();
  }

  function toggleMaximize(): void {
    void api?.toggleMaximize();
  }

  function close(): void {
    void api?.close();
  }

  function dispose(): void {
    unsubscribe?.();
    unsubscribe = null;
    initialized = false;
  }

  return {
    isDesktop,
    isMaximized,
    minimize,
    toggleMaximize,
    close,
    dispose,
  };
}
