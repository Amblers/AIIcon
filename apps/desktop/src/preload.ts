import { contextBridge, ipcRenderer } from 'electron';

interface WindowState {
  maximized: boolean;
  fullScreen: boolean;
}

const api = {
  isDesktop: true,
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggle-maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  onWindowState: (callback: (state: WindowState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: WindowState) => {
      callback(state);
    };
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  },
};

contextBridge.exposeInMainWorld('aiiconDesktop', api);
