import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { sanitizeSvg } from '@/utils/safeSvg';

export function useSvgPreview(svg: Ref<string | null>): {
  url: Ref<string | null>;
  failed: Ref<boolean>;
} {
  const url = ref<string | null>(null);
  const failed = ref(false);
  let currentUrl: string | null = null;

  const cleanup = () => {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    url.value = null;
  };

  watch(
    svg,
    (value) => {
      cleanup();
      failed.value = false;
      if (!value) return;
      try {
        const clean = sanitizeSvg(value);
        const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
        currentUrl = URL.createObjectURL(blob);
        url.value = currentUrl;
      } catch {
        failed.value = true;
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(cleanup);

  return { url, failed };
}
