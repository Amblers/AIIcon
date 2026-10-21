<script setup lang="ts">
import { computed } from 'vue';
import { ImageOff } from 'lucide-vue-next';
import { useSvgPreview } from '@/composables/useSvgPreview';

const props = defineProps<{
  svg: string;
  alt: string;
}>();

const svgRef = computed(() => props.svg);
const { url, failed } = useSvgPreview(svgRef);
</script>

<template>
  <img
    v-if="url && !failed"
    :src="url"
    :alt="alt"
    class="svg-preview"
    draggable="false"
  />
  <span v-else class="svg-preview-failed" role="img" :aria-label="alt">
    <ImageOff :size="22" />
  </span>
</template>

<style scoped>
.svg-preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.svg-preview-failed {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--faint);
}
</style>
