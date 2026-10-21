<script setup lang="ts">
import { useDesktopWindow } from '@/composables/useDesktopWindow';

const { isDesktop, isMaximized, minimize, toggleMaximize, close } = useDesktopWindow();
</script>

<template>
  <div v-if="isDesktop" class="window-controls" aria-label="窗口控制">
    <button
      type="button"
      class="window-control"
      title="最小化"
      aria-label="最小化窗口"
      @click="minimize"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5h10" />
      </svg>
    </button>

    <button
      type="button"
      class="window-control"
      :title="isMaximized ? '半屏' : '全屏'"
      :aria-label="isMaximized ? '还原为半屏窗口' : '全屏窗口'"
      @click="toggleMaximize"
    >
      <svg v-if="isMaximized" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3.4" y="5.6" width="7" height="7" rx="1" />
        <path d="M5.8 5.6V4.4c0-.6.4-1 1-1h5.2c.6 0 1 .4 1 1v5.2c0 .6-.4 1-1 1h-1.2" />
      </svg>
      <svg v-else viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
      </svg>
    </button>

    <button
      type="button"
      class="window-control window-control--close"
      title="关闭"
      aria-label="关闭窗口"
      @click="close"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 3px;
  border-left: 1px solid var(--line);
  padding-left: 7px;
  -webkit-app-region: no-drag;
}

.window-control {
  display: grid;
  place-items: center;
  width: 36px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  transition: background 140ms ease, color 140ms ease;
}

.window-control svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.25;
}

.window-control:hover {
  background: rgba(23, 33, 27, 0.07);
  color: var(--ink);
}

.window-control--close:hover {
  background: #c8423a;
  color: #fff;
}

@media (max-width: 520px) {
  .window-control {
    width: 32px;
  }
}
</style>
