<script setup lang="ts">
withDefaults(
  defineProps<{
    index: string;
    title: string;
    hint?: string;
  }>(),
  { hint: '' },
);
</script>

<template>
  <div class="section-head">
    <div>
      <div class="section-head__title-row">
        <span class="section-head__index">{{ index }}</span>
        <h2 class="section-head__title">{{ title }}</h2>
      </div>
      <p v-if="hint" class="section-head__hint">{{ hint }}</p>
    </div>
    <div v-if="$slots.meta" class="section-head__meta">
      <slot name="meta" />
    </div>
  </div>
</template>

<style scoped>
.section-head__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
  flex: 0 0 auto;
}
</style>
