import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  shell,
} from 'electron';
import {
  startDesktopServer,
  type DesktopServerHandle,
} from '@aiicon/server/desktop';

const APP_ID = 'com.aiicon.studio';
let mainWindow: BrowserWindow | null = null;
let serverHandle: DesktopServerHandle | null = null;
let isQuitting = false;
let downloadHandlerRegistered = false;

app.setName('AIICON');
// Keep the desktop profile separate from the browser/BFF config directory.
app.setPath('userData', path.join(app.getPath('appData'), 'AIICON Desktop'));
app.setAppUserModelId(APP_ID);

function resolveWebDist(): string {
  const override = process.env.AIICON_DESKTOP_WEB_DIST?.trim();
  if (override) return path.resolve(override);
  if (app.isPackaged) return path.join(process.resourcesPath, 'web');
  return path.resolve(__dirname, '../../web/dist');
}

function resolveConfigDir(): string {
  const override = process.env.AIICON_DESKTOP_CONFIG_DIR?.trim();
  if (override) return path.resolve(override);
  return path.join(app.getPath('userData'), 'config');
}

function resolveIconPath(): string | undefined {
  const candidate = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.resolve(__dirname, '../build/icon.ico');
  return existsSync(candidate) ? candidate : undefined;
}

function currentWindowState(win: BrowserWindow) {
  return {
    maximized: win.isMaximized(),
    fullScreen: win.isFullScreen(),
  };
}

function sendWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.webContents.send('window:state', currentWindowState(win));
}

function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win === mainWindow ? win : null;
}

function registerDownloadHandler(win: BrowserWindow): void {
  if (downloadHandlerRegistered) return;
  downloadHandlerRegistered = true;
  win.webContents.session.on('will-download', (_event, item) => {
    const fileName = item.getFilename();
    const extension = path.extname(fileName).slice(1).toLowerCase();
    const filter =
      extension === 'svg'
        ? { name: 'SVG 矢量图标', extensions: ['svg'] }
        : extension === 'zip'
          ? { name: 'ZIP 压缩包', extensions: ['zip'] }
          : extension === 'png'
            ? { name: 'PNG 图片', extensions: ['png'] }
            : null;
    item.setSaveDialogOptions({
      title: '保存图稿',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      ...(filter ? { filters: [filter] } : {}),
    });
  });
}

function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event) => {
    windowFromEvent(event)?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = windowFromEvent(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.handle('window:is-maximized', (event) => {
    return windowFromEvent(event)?.isMaximized() ?? false;
  });

  ipcMain.handle('window:close', (event) => {
    windowFromEvent(event)?.close();
  });
}

function createMainWindow(url: string): void {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.max(980, Math.min(1440, workArea.width - 40));
  const height = Math.max(700, Math.min(980, workArea.height - 40));
  const icon = resolveIconPath();

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 980,
    minHeight: 700,
    frame: false,
    show: false,
    title: 'AIICON',
    backgroundColor: '#f3f0e8',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(url).catch((error) => {
    dialog.showErrorBox('AIICON 加载失败', String(error));
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    if (mainWindow) sendWindowState(mainWindow);
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow) sendWindowState(mainWindow);
  });
  mainWindow.on('enter-full-screen', () => {
    if (mainWindow) sendWindowState(mainWindow);
  });
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow) sendWindowState(mainWindow);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) sendWindowState(mainWindow);
  });

  const serverOrigin = new URL(url).origin;
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(`${serverOrigin}/`) && targetUrl !== serverOrigin) {
      event.preventDefault();
    }
  });

  registerDownloadHandler(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        void shell.openExternal(targetUrl);
      }
    } catch {
      // Ignore malformed URLs.
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  Menu.setApplicationMenu(null);

  const webDist = resolveWebDist();
  if (!existsSync(path.join(webDist, 'index.html'))) {
    throw new Error(`找不到前端资源：${webDist}\n请先运行 pnpm build。`);
  }

  serverHandle = await startDesktopServer({
    configDir: resolveConfigDir(),
    webDist,
    host: '127.0.0.1',
    port: 0,
    envKey: null,
    baseUrl: process.env.AIICON_DESKTOP_BASE_URL?.trim() || 'https://api.deepseek.com',
    defaultModel: process.env.AIICON_DESKTOP_MODEL?.trim() || 'deepseek-flash',
    timeoutMs: 90_000,
  });

  registerWindowIpc();
  createMainWindow(serverHandle.url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await bootstrap();
    } catch (error) {
      dialog.showErrorBox(
        'AIICON 启动失败',
        error instanceof Error ? error.stack ?? error.message : String(error),
      );
      app.quit();
    }
  });

  app.on('activate', () => {
    if (!mainWindow && serverHandle) createMainWindow(serverHandle.url);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', (event) => {
    if (!serverHandle || isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    const handle = serverHandle;
    serverHandle = null;
    void handle
      .close()
      .catch(() => undefined)
      .finally(() => {
        app.quit();
      });
  });
}
