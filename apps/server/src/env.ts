import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(here, '../../../.env');
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, quiet: true });
}

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvApiKey(): string | null {
  const value = process.env.DEEPSEEK_API_KEY?.trim();
  return value ? value : null;
}

export function getBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '');
}

export function getDefaultModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash';
}

export function getUpstreamTimeoutMs(): number {
  return readInt(process.env.DEEPSEEK_TIMEOUT_MS, 90_000);
}

export function getServerHost(): string {
  return process.env.HOST?.trim() || '127.0.0.1';
}

export function getServerPort(): number {
  return readInt(process.env.PORT, 8787);
}

export function getConfigDir(): string {
  const explicit = process.env.AIICON_CONFIG_DIR?.trim();
  if (explicit) return resolve(explicit);

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA?.trim() || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'AIicon');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'AIicon');
  }
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config');
  return join(configHome, 'aiicon');
}

export function getClientDistPath(): string {
  return resolve(here, '../../web/dist');
}
