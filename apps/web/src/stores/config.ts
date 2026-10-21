import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { DeepSeekConfig, TestConnectionResponse } from '@aiicon/shared';
import { api } from '@/api/client';

export const useConfigStore = defineStore('config', () => {
  const config = ref<DeepSeekConfig | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const testing = ref(false);
  const loadError = ref<string | null>(null);
  const hasLoaded = ref(false);

  const configured = computed(() => Boolean(config.value?.configured));
  const source = computed(() => config.value?.source ?? 'none');
  const model = computed(() => config.value?.model ?? 'deepseek-flash');
  const isEnvKey = computed(() => config.value?.source === 'env');
  const maskedKey = computed(() => config.value?.maskedKey ?? null);
  const offline = computed(() => Boolean(loadError.value) && !hasLoaded.value);

  async function load(force = false): Promise<void> {
    if (loading.value) return;
    if (hasLoaded.value && !force) return;
    loading.value = true;
    try {
      config.value = await api.getConfig();
      loadError.value = null;
      hasLoaded.value = true;
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '无法读取配置';
    } finally {
      loading.value = false;
    }
  }

  async function save(payload: { apiKey?: string; model: string }): Promise<DeepSeekConfig> {
    saving.value = true;
    try {
      config.value = await api.saveConfig(payload);
      loadError.value = null;
      hasLoaded.value = true;
      return config.value;
    } finally {
      saving.value = false;
    }
  }

  async function clearKey(): Promise<DeepSeekConfig> {
    saving.value = true;
    try {
      config.value = await api.clearKey();
      return config.value;
    } finally {
      saving.value = false;
    }
  }

  async function testConnection(payload: { apiKey?: string; model?: string }): Promise<TestConnectionResponse> {
    testing.value = true;
    try {
      return await api.testConnection(payload);
    } finally {
      testing.value = false;
    }
  }

  return {
    config,
    loading,
    saving,
    testing,
    loadError,
    hasLoaded,
    configured,
    source,
    model,
    isEnvKey,
    maskedKey,
    offline,
    load,
    save,
    clearKey,
    testConnection,
  };
});
