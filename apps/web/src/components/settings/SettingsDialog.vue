<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-vue-next';
import { MODEL_PRESETS, type TestConnectionResponse } from '@aiicon/shared';
import { showToast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import BaseModal from '@/components/ui/BaseModal.vue';

const ui = useUiStore();
const config = useConfigStore();
const workspace = useWorkspaceStore();

const showKey = ref(false);
const keyDraft = ref('');
const modelMode = ref<string>(MODEL_PRESETS[0]);
const customModel = ref('');
const localError = ref('');
const testState = ref<'idle' | 'testing' | 'passed' | 'failed'>('idle');
const testResult = ref<TestConnectionResponse | null>(null);
const clearPending = ref(false);

const open = computed({
  get: () => ui.settingsOpen,
  set: (value: boolean) => {
    if (value) ui.openSettings();
    else ui.closeSettings();
  },
});

const finalModel = computed(() =>
  modelMode.value === 'custom' ? customModel.value.trim() : modelMode.value,
);

const isEnvKey = computed(() => config.isEnvKey);
const configured = computed(() => config.configured);
const busy = computed(() => config.saving || config.testing);

const keyPlaceholder = computed(() => {
  if (isEnvKey.value) return '由环境变量提供';
  if (config.maskedKey) return `已保存 ${config.maskedKey}；留空则不修改`;
  return 'sk-...';
});

const statusText = computed(() => {
  if (config.loading) return '正在读取本地配置…';
  if (config.loadError && !config.hasLoaded) return config.loadError;
  if (isEnvKey.value) return '当前 Key 来自环境变量';
  if (configured.value) return 'DeepSeek 已连接配置';
  return '尚未配置 API Key';
});

function resetLocalState(): void {
  keyDraft.value = '';
  showKey.value = false;
  localError.value = '';
  testState.value = 'idle';
  testResult.value = null;
  clearPending.value = false;
  const current = config.model;
  if ((MODEL_PRESETS as readonly string[]).includes(current)) {
    modelMode.value = current;
    customModel.value = '';
  } else {
    modelMode.value = 'custom';
    customModel.value = current;
  }
}

async function initialize(): Promise<void> {
  resetLocalState();
  if (!config.hasLoaded || config.loadError) {
    await config.load(true);
    resetLocalState();
  }
}

watch(
  () => ui.settingsOpen,
  (isOpen) => {
    if (isOpen) void initialize();
  },
);

function validateLocal(): boolean {
  localError.value = '';
  if (!finalModel.value) {
    localError.value = '请选择或填写模型名称';
    return false;
  }
  if (!configured.value && !isEnvKey.value && !keyDraft.value.trim()) {
    localError.value = '首次配置需要填写 DeepSeek API Key';
    return false;
  }
  if (keyDraft.value.trim() && keyDraft.value.trim().length < 8) {
    localError.value = 'API Key 长度不正确';
    return false;
  }
  return true;
}

async function testConnection(): Promise<void> {
  if (workspace.isRunning || busy.value) return;
  if (!validateLocal()) return;
  testState.value = 'testing';
  testResult.value = null;
  try {
    const result = await config.testConnection({
      model: finalModel.value,
      ...(keyDraft.value.trim() ? { apiKey: keyDraft.value.trim() } : {}),
    });
    testResult.value = result;
    testState.value = result.ok ? 'passed' : 'failed';
    if (!result.ok) {
      localError.value = result.error?.message ?? '连接测试失败';
    }
  } catch (error) {
    testState.value = 'failed';
    localError.value = error instanceof Error ? error.message : '连接测试失败';
  }
}

async function save(): Promise<void> {
  if (workspace.isRunning || busy.value) return;
  if (!validateLocal()) return;
  try {
    await config.save({
      model: finalModel.value,
      ...(keyDraft.value.trim() ? { apiKey: keyDraft.value.trim() } : {}),
    });
    ui.closeSettings();
    showToast('DeepSeek 配置已保存。', 'success');
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '保存配置失败';
  }
}

function requestClear(): void {
  clearPending.value = true;
}

async function confirmClear(): Promise<void> {
  clearPending.value = false;
  try {
    await config.clearKey();
    keyDraft.value = '';
    resetLocalState();
    showToast('本地保存的 API Key 已清除。', 'info');
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '清除失败';
  }
}

function openDeepSeekKeys(): void {
  window.open('https://platform.deepseek.com/api_keys', '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <BaseModal
    v-model="open"
    title="DeepSeek 设置"
    subtitle="配置 API Key 与模型；Key 仅保存在本地服务端。"
    width="570px"
    :close-disabled="busy"
  >
    <div
      class="settings-status"
      :class="{
        'settings-status--offline': Boolean(config.loadError),
        'settings-status--idle': !configured && !config.loadError,
      }"
    >
      <span class="settings-status__dot" />
      <span>{{ statusText }}</span>
      <button
        v-if="config.loadError"
        type="button"
        class="settings-retry"
        :disabled="config.loading"
        @click="initialize"
      >
        <RefreshCw :size="11" :class="{ spin: config.loading }" />
        重试
      </button>
      <span v-else-if="configured" class="settings-status__source">
        {{ isEnvKey ? 'ENV' : 'LOCAL VAULT' }}
      </span>
    </div>

    <div v-if="workspace.isRunning" class="settings-running">
      <LoaderCircle :size="13" class="spin" />
      生成进行中，配置暂时只读。完成后可继续修改。
    </div>

    <section class="settings-section">
      <div class="settings-section__head">
        <span class="settings-icon"><KeyRound :size="14" /></span>
        <div>
          <h3>API Key</h3>
          <p>{{ isEnvKey ? 'Key 由环境变量 DEEPSEEK_API_KEY 提供。' : '输入新的 Key 可覆盖已保存的 Key。' }}</p>
        </div>
      </div>

      <div v-if="isEnvKey" class="env-key">
        <ShieldCheck :size="15" />
        <code>{{ config.maskedKey }}</code>
        <span>环境变量</span>
      </div>
      <div v-else class="key-input-wrap">
        <input
          v-model="keyDraft"
          :type="showKey ? 'text' : 'password'"
          class="text-field key-input"
          :placeholder="keyPlaceholder"
          :disabled="busy || workspace.isRunning"
          autocomplete="off"
          spellcheck="false"
          aria-label="DeepSeek API Key"
          autofocus
        />
        <button
          type="button"
          class="icon-btn key-visibility"
          :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'"
          :disabled="busy || workspace.isRunning"
          @click="showKey = !showKey"
        >
          <EyeOff v-if="showKey" :size="15" />
          <Eye v-else :size="15" />
        </button>
      </div>

      <div class="settings-inline-actions">
        <button
          type="button"
          class="text-link"
          :disabled="busy || workspace.isRunning"
          @click="testConnection"
        >
          <LoaderCircle v-if="testState === 'testing'" :size="12" class="spin" />
          <CheckCircle2 v-else-if="testState === 'passed'" :size="12" />
          <AlertCircle v-else-if="testState === 'failed'" :size="12" />
          <RefreshCw v-else :size="12" />
          {{ testState === 'testing' ? '测试中…' : '测试连接' }}
        </button>
        <button
          v-if="config.source === 'file' && configured"
          type="button"
          class="text-link text-link--danger"
          :disabled="busy || workspace.isRunning"
          @click="requestClear"
        >
          <Trash2 :size="12" />
          清除本地 Key
        </button>
        <button type="button" class="text-link" @click="openDeepSeekKeys">
          获取 API Key
          <ExternalLink :size="10" />
        </button>
      </div>

      <div
        v-if="testState === 'passed' && testResult?.ok"
        class="test-result test-result--ok"
      >
        <CheckCircle2 :size="13" />
        连接成功，模型 {{ testResult.model }}，耗时 {{ testResult.latencyMs }}ms。
      </div>
      <div
        v-else-if="testState === 'failed'"
        class="test-result test-result--failed"
      >
        <AlertCircle :size="13" />
        {{ testResult?.error?.message ?? localError }}
      </div>

      <div v-if="clearPending" class="clear-confirm">
        <span>确定删除本地保存的 Key？之后需要重新配置才能生成。</span>
        <div>
          <button type="button" class="btn btn--sm btn--ghost" @click="clearPending = false">取消</button>
          <button type="button" class="btn btn--sm btn--danger" @click="confirmClear">确认删除</button>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-section__head">
        <span class="settings-icon settings-icon--model">M</span>
        <div>
          <h3>模型</h3>
          <p>默认使用 DeepSeek 官方当前推荐的 Flash 模型，也可填写自定义模型名。</p>
        </div>
      </div>

      <div class="model-grid">
        <select
          v-model="modelMode"
          class="text-field model-select"
          :disabled="busy || workspace.isRunning"
          aria-label="选择模型"
        >
          <option v-for="model in MODEL_PRESETS" :key="model" :value="model">{{ model }}</option>
          <option value="custom">自定义模型…</option>
        </select>
        <input
          v-if="modelMode === 'custom'"
          v-model="customModel"
          type="text"
          class="text-field"
          placeholder="例如 deepseek-v4-pro"
          maxlength="80"
          :disabled="busy || workspace.isRunning"
          aria-label="自定义模型名称"
        />
      </div>
    </section>

    <div v-if="localError" class="settings-error" role="alert">
      <AlertCircle :size="13" />
      {{ localError }}
    </div>

    <div class="security-note">
      <ShieldCheck :size="15" />
      <p>
        Key 通过同源本地服务转发到 DeepSeek，并加密保存在你的机器上；不会写入浏览器
        localStorage，也不会出现在前端日志中。该加密用于避免误读，不防御已取得本机账户权限的攻击者。
      </p>
    </div>

    <template #footer>
      <div class="settings-footer">
        <span class="settings-footer__hint">修改模型不需要重新填写 Key</span>
        <div class="settings-footer__actions">
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="open = false">取消</button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="busy || workspace.isRunning"
            @click="save"
          >
            <LoaderCircle v-if="config.saving" :size="14" class="spin" />
            {{ config.saving ? '保存中…' : '保存配置' }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.settings-status {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 35px;
  border: 1px solid rgba(40, 119, 90, 0.16);
  border-radius: 9px;
  background: var(--success-soft);
  padding: 0 10px;
  color: var(--success);
  font-size: 11px;
  font-weight: 600;
}

.settings-status--offline {
  border-color: rgba(153, 100, 24, 0.18);
  background: var(--warning-soft);
  color: var(--warning);
}

.settings-status--idle {
  border-color: var(--line);
  background: var(--surface-soft);
  color: var(--muted);
}

.settings-status--idle .settings-status__dot {
  background: var(--coral);
  box-shadow: 0 0 0 3px rgba(239, 119, 88, 0.1);
}

.settings-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent);
}

.settings-status__source {
  margin-left: auto;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 8.5px;
  letter-spacing: 0.06em;
  opacity: 0.62;
}

.settings-retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  border: 0;
  background: transparent;
  color: currentColor;
  font-size: 10px;
  font-weight: 650;
}

.settings-running {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  border-radius: 8px;
  background: var(--warning-soft);
  padding: 8px 9px;
  color: var(--warning);
  font-size: 10.5px;
}

.settings-section {
  margin-top: 20px;
}

.settings-section + .settings-section {
  border-top: 1px solid var(--line);
  padding-top: 19px;
}

.settings-section__head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 11px;
}

.settings-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 7px;
  background: var(--forest-soft);
  color: var(--forest);
}

.settings-icon--model {
  font-family: var(--font-display);
  font-size: 14px;
  font-style: italic;
  font-weight: 600;
}

.settings-section__head h3 {
  font-size: 13px;
  font-weight: 680;
}

.settings-section__head p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.key-input-wrap {
  position: relative;
}

.key-input {
  padding-right: 42px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.01em;
}

.key-visibility {
  position: absolute;
  top: 50%;
  right: 4px;
  width: 30px;
  height: 30px;
  transform: translateY(-50%);
}

.env-key {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  padding: 0 10px;
  color: var(--forest);
}

.env-key code {
  font-size: 10.5px;
}

.env-key span {
  margin-left: auto;
  color: var(--faint);
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.05em;
}

.settings-inline-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 9px;
}

.text-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--forest);
  font-size: 10.5px;
  font-weight: 600;
}

.text-link:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.text-link:disabled {
  opacity: 0.5;
}

.text-link--danger {
  color: var(--danger);
}

.test-result {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 9px;
  border-radius: 7px;
  padding: 7px 8px;
  font-size: 10.5px;
  line-height: 1.45;
}

.test-result svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.test-result--ok {
  background: var(--success-soft);
  color: var(--success);
}

.test-result--failed {
  background: var(--danger-soft);
  color: var(--danger);
}

.clear-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  border: 1px solid rgba(187, 68, 60, 0.18);
  border-radius: 8px;
  background: #fffafa;
  padding: 8px 9px;
  color: var(--danger);
  font-size: 10.5px;
}

.clear-confirm > div {
  display: flex;
  gap: 5px;
  flex: 0 0 auto;
}

.model-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.model-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 14px) 17px, calc(100% - 9px) 17px;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 30px;
}

.settings-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 14px;
  border-radius: 7px;
  background: var(--danger-soft);
  padding: 8px 9px;
  color: var(--danger);
  font-size: 10.5px;
  line-height: 1.45;
}

.settings-error svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.security-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 17px;
  border-top: 1px dashed var(--line);
  padding-top: 13px;
  color: var(--faint);
}

.security-note svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--forest);
}

.security-note p {
  font-size: 9.5px;
  line-height: 1.6;
}

.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
}

.settings-footer__hint {
  color: var(--faint);
  font-size: 9.5px;
}

.settings-footer__actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

@media (max-width: 560px) {
  .model-grid {
    grid-template-columns: 1fr;
  }
  .settings-footer {
    align-items: flex-end;
    flex-direction: column;
    gap: 8px;
  }
  .settings-footer__hint {
    display: none;
  }
  .clear-confirm {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
