<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight, Settings2, ShieldCheck, Sparkles } from 'lucide-vue-next';
import WindowControls from './WindowControls.vue';
import { useDesktopWindow } from '@/composables/useDesktopWindow';
import { useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';

const config = useConfigStore();
const ui = useUiStore();
const { isDesktop } = useDesktopWindow();

const status = computed(() => {
  if (config.loading && !config.hasLoaded) {
    return { label: '连接本地服务', tone: 'loading' as const };
  }
  if (config.loadError && !config.hasLoaded) {
    return { label: '本地服务离线', tone: 'offline' as const };
  }
  if (config.configured) {
    return {
      label: config.isEnvKey ? 'DeepSeek · ENV' : 'DeepSeek 已就绪',
      tone: 'ready' as const,
    };
  }
  return { label: '未配置 API', tone: 'idle' as const };
});
</script>

<template>
  <header
    class="app-header"
    :class="{ 'app-header--desktop': isDesktop }"
  >
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-mark__spark"><Sparkles :size="15" :stroke-width="1.8" /></span>
        <span class="brand-mark__dot" />
      </div>
      <div class="brand-copy">
        <div class="brand-name">AIICON</div>
        <span class="brand-sub">VECTOR ICON STUDIO</span>
      </div>
    </div>

    <div class="header-center" aria-hidden="true">
      <span class="header-center__line" />
      <span class="header-center__text">MAKE / PREVIEW / SHIP</span>
      <span class="header-center__line" />
    </div>

    <div class="header-actions">
      <span class="local-pill">
        <ShieldCheck :size="11" />
        LOCAL ONLY
      </span>
      <button
        type="button"
        class="api-status"
        :class="`api-status--${status.tone}`"
        title="打开 DeepSeek 设置"
        @click="ui.openSettings"
      >
        <span class="api-status__dot" />
        <span>{{ status.label }}</span>
        <ArrowUpRight :size="11" class="api-status__arrow" />
      </button>
      <button
        type="button"
        class="settings-button"
        aria-label="打开设置"
        @click="ui.openSettings"
      >
        <Settings2 :size="15" />
        <span>设置</span>
      </button>
      <WindowControls />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 66px;
  flex: 0 0 66px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-soft);
  padding: 0 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 10px;
  background: var(--ink);
  color: var(--acid);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.brand-mark__spark {
  display: grid;
  place-items: center;
}

.brand-mark__dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--coral);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-name {
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 18px;
  font-weight: 760;
  letter-spacing: 0.015em;
  line-height: 1;
}

.brand-sub {
  color: var(--faint);
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 410px;
  color: var(--faint);
}

.header-center__line {
  height: 1px;
  flex: 1;
  background: var(--line);
}

.header-center__text {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 7.5px;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.local-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--faint);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 7.5px;
  letter-spacing: 0.08em;
}

.api-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 31px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  padding: 0 9px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  transition: border-color 150ms ease, background 150ms ease;
}

.api-status:hover {
  border-color: var(--line-strong);
  background: var(--surface-soft);
}

.api-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--faint);
}

.api-status--ready {
  color: var(--success);
}

.api-status--ready .api-status__dot {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(40, 119, 90, 0.1);
}

.api-status--idle .api-status__dot,
.api-status--offline .api-status__dot {
  background: var(--coral);
}

.api-status--offline {
  color: var(--warning);
}

.api-status--loading .api-status__dot {
  background: var(--warning);
  animation: pulse-dot 1.4s ease-in-out infinite;
}

.api-status__arrow {
  opacity: 0.35;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.settings-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 31px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 0 9px;
  color: var(--ink-soft);
  font-size: 10.5px;
  font-weight: 600;
}

.settings-button:hover {
  background: var(--surface-muted);
}

@media (max-width: 1100px) {
  .header-center,
  .local-pill {
    display: none;
  }
  .app-header {
    padding: 0 16px;
  }
}

@media (max-width: 620px) {
  .settings-button span {
    display: none;
  }
  .api-status {
    max-width: 150px;
  }
  .api-status span:nth-child(2) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .brand-sub {
    display: none;
  }
  .brand {
    min-width: 0;
  }
}
</style>
