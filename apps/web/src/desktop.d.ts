export interface DesktopWindowState {
  maximized: boolean;
  fullScreen: boolean;
}

export interface AiiconDesktopApi {
  isDesktop: boolean;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowState: (callback: (state: DesktopWindowState) => void) => () => void;
}

declare global {
  interface Window {
    aiiconDesktop?: AiiconDesktopApi;
  }
}

export {};
