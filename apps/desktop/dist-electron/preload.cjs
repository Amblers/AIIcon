"use strict";

// src/preload.ts
var import_electron = require("electron");
var api = {
  isDesktop: true,
  minimize: () => import_electron.ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => import_electron.ipcRenderer.invoke("window:toggle-maximize"),
  close: () => import_electron.ipcRenderer.invoke("window:close"),
  isMaximized: () => import_electron.ipcRenderer.invoke("window:is-maximized"),
  onWindowState: (callback) => {
    const listener = (_event, state) => {
      callback(state);
    };
    import_electron.ipcRenderer.on("window:state", listener);
    return () => import_electron.ipcRenderer.removeListener("window:state", listener);
  }
};
import_electron.contextBridge.exposeInMainWorld("aiiconDesktop", api);
