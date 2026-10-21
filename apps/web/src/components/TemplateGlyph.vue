<script setup lang="ts">
import { computed } from 'vue';
import type { TemplateId } from '@aiicon/shared';

const props = withDefaults(
  defineProps<{
    templateId: TemplateId;
    size?: number | string;
  }>(),
  { size: 40 },
);

const dimensions = computed(() => ({
  width: props.size,
  height: props.size,
}));

const star =
  'M256 92C274.5 183 329 237.5 420 256C329 274.5 274.5 329 256 420C237.5 329 183 274.5 92 256C183 237.5 237.5 183 256 92Z';
const starSmall =
  'M256 182C264 221 291 248 330 256C291 264 264 291 256 330C248 291 221 264 182 256C221 248 248 221 256 182Z';
</script>

<template>
  <svg
    :width="dimensions.width"
    :height="dimensions.height"
    viewBox="0 0 512 512"
    fill="none"
    aria-hidden="true"
    class="template-glyph"
  >
    <template v-if="templateId === 'line'">
      <g stroke="#183F35" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
        <path :d="star" />
        <circle cx="397" cy="113" r="17" fill="#183F35" stroke="none" />
      </g>
    </template>

    <template v-else-if="templateId === 'solid'">
      <path :d="star" fill="#183F35" />
      <path :d="starSmall" fill="#2D6B55" />
      <circle cx="397" cy="113" r="17" fill="#183F35" />
    </template>

    <template v-else-if="templateId === 'mono'">
      <path :d="star" fill="#183F35" />
      <circle cx="397" cy="113" r="17" fill="#183F35" />
    </template>

    <template v-else-if="templateId === 'multicolor'">
      <path :d="star" fill="#183F35" />
      <path
        d="M395 94C401 121 418 138 445 144C418 150 401 167 395 194C389 167 372 150 345 144C372 138 389 121 395 94Z"
        fill="#EF7758"
      />
      <circle cx="121" cy="390" r="26" fill="#D9E95E" />
    </template>

    <template v-else-if="templateId === 'circle-bg'">
      <circle cx="256" cy="256" r="256" fill="#1B4B3C" />
      <g transform="translate(86 86) scale(0.67)">
        <path :d="star" fill="#F8F3E6" />
        <circle cx="397" cy="113" r="17" fill="#DFF06E" />
      </g>
    </template>

    <template v-else-if="templateId === 'square-bg'">
      <rect width="512" height="512" fill="#DDF06E" />
      <g transform="translate(86 86) scale(0.67)">
        <path :d="star" fill="#183F35" />
        <circle cx="397" cy="113" r="17" fill="#183F35" />
      </g>
    </template>

    <template v-else>
      <rect width="512" height="512" rx="122" fill="#2958E8" />
      <g transform="translate(86 86) scale(0.67)">
        <path :d="star" fill="#FFFFFF" />
        <circle cx="397" cy="113" r="17" fill="#DFF06E" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.template-glyph {
  display: block;
  flex: 0 0 auto;
}
</style>
