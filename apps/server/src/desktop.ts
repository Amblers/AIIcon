import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { ConfigVault } from './services/config-vault';

export interface DesktopServerOptions {
  configDir: string;
  webDist: string;
  host?: string;
  port?: number;
  defaultModel?: string;
  baseUrl?: string;
  envKey?: string | null;
  timeoutMs?: number;
}

export interface DesktopServerHandle {
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts the same local BFF used by the browser app, but on an ephemeral port.
 * The Electron main process can own it for the lifetime of the desktop window.
 */
export async function startDesktopServer(
  options: DesktopServerOptions,
): Promise<DesktopServerHandle> {
  const host = options.host ?? '127.0.0.1';
  const vault = new ConfigVault({
    dir: options.configDir,
    envKey: options.envKey ?? null,
    defaultModel: options.defaultModel ?? 'deepseek-flash',
    baseUrl: options.baseUrl ?? 'https://api.deepseek.com',
  });

  const app = await createApp({
    vault,
    timeoutMs: options.timeoutMs ?? 90_000,
    webDist: options.webDist,
    logger: false,
  });

  try {
    await app.listen({ host, port: options.port ?? 0 });
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }

  const address = app.server.address();
  if (!address || typeof address === 'string') {
    await app.close().catch(() => undefined);
    throw new Error('无法获取本地服务端口');
  }
  const info = address as AddressInfo;

  return {
    host: info.address,
    port: info.port,
    url: `http://${host}:${info.port}`,
    close: async () => {
      await app.close();
    },
  };
}
