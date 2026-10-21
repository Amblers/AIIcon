import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ConfigSource, DeepSeekConfig } from '@aiicon/shared';
import { AppError } from '../errors';

interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

interface StoredConfig {
  version: 1;
  model: string;
  updatedAt: string;
  key?: EncryptedSecret;
}

export interface ConfigVaultOptions {
  dir: string;
  envKey: string | null;
  defaultModel: string;
  baseUrl: string;
}

const AAD = Buffer.from('aiicon:deepseek-key:v1', 'utf8');

function normalizeModel(model: string | undefined, fallback: string): string {
  const value = model?.trim();
  return value ? value : fallback;
}

export class ConfigVault {
  readonly dir: string;
  readonly envKey: string | null;
  readonly defaultModel: string;
  readonly baseUrl: string;
  private readonly configPath: string;
  private readonly vaultKeyPath: string;

  constructor(options: ConfigVaultOptions) {
    this.dir = options.dir;
    this.envKey = options.envKey;
    this.defaultModel = options.defaultModel;
    this.baseUrl = options.baseUrl;
    this.configPath = join(options.dir, 'config.json');
    this.vaultKeyPath = join(options.dir, 'vault.key');
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
  }

  private async readVaultKey(): Promise<Buffer | null> {
    try {
      const encoded = await readFile(this.vaultKeyPath, 'utf8');
      const key = Buffer.from(encoded.trim(), 'base64');
      if (key.length !== 32) return null;
      return key;
    } catch {
      return null;
    }
  }

  private async getOrCreateVaultKey(): Promise<Buffer> {
    await this.ensureDir();
    const existing = await this.readVaultKey();
    if (existing) return existing;

    const key = randomBytes(32);
    try {
      await writeFile(this.vaultKeyPath, key.toString('base64'), {
        mode: 0o600,
        flag: 'wx',
      });
      await chmod(this.vaultKeyPath, 0o600).catch(() => undefined);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const raced = await this.readVaultKey();
      if (!raced) throw error;
      return raced;
    }
    return key;
  }

  private async readConfig(): Promise<StoredConfig | null> {
    try {
      const raw = await readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredConfig>;
      if (parsed.version !== 1) return null;
      return {
        version: 1,
        model: typeof parsed.model === 'string' ? parsed.model : this.defaultModel,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        ...(parsed.key ? { key: parsed.key } : {}),
      };
    } catch {
      return null;
    }
  }

  private async writeConfig(config: StoredConfig): Promise<void> {
    await this.ensureDir();
    const tempPath = join(dirname(this.configPath), `.config-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
    await writeFile(tempPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    await rename(tempPath, this.configPath);
    await chmod(this.configPath, 0o600).catch(() => undefined);
  }

  private encryptKey(plaintext: string, vaultKey: Buffer): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', vaultKey, iv);
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  private decryptKey(secret: EncryptedSecret, vaultKey: Buffer): string | null {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        vaultKey,
        Buffer.from(secret.iv, 'base64'),
      );
      decipher.setAAD(AAD);
      decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(secret.ciphertext, 'base64')),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch {
      return null;
    }
  }

  async getFileKey(): Promise<string | null> {
    const config = await this.readConfig();
    if (!config?.key) return null;
    const vaultKey = await this.readVaultKey();
    if (!vaultKey) return null;
    return this.decryptKey(config.key, vaultKey);
  }

  async getApiKey(): Promise<string | null> {
    if (this.envKey) return this.envKey;
    return this.getFileKey();
  }

  async getModel(): Promise<string> {
    const config = await this.readConfig();
    return normalizeModel(config?.model, this.defaultModel);
  }

  async getStatus(): Promise<DeepSeekConfig> {
    const config = await this.readConfig();
    const apiKey = this.envKey ?? (config?.key ? await this.getFileKey() : null);
    const source: ConfigSource = this.envKey ? 'env' : apiKey ? 'file' : 'none';
    return {
      configured: Boolean(apiKey),
      source,
      maskedKey: apiKey ? this.maskKey(apiKey) : null,
      model: normalizeModel(config?.model, this.defaultModel),
      baseUrl: this.baseUrl,
      provider: 'deepseek',
    };
  }

  maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 3)}••••••••${key.slice(-4)}`;
  }

  async save(input: { apiKey?: string; model: string }): Promise<DeepSeekConfig> {
    if (this.envKey && input.apiKey) {
      throw new AppError('CONFIG_ENV_READONLY', { statusCode: 409 });
    }
    const existing = await this.readConfig();
    const next: StoredConfig = {
      version: 1,
      model: normalizeModel(input.model, this.defaultModel),
      updatedAt: new Date().toISOString(),
      ...(existing?.key ? { key: existing.key } : {}),
    };

    if (input.apiKey) {
      const vaultKey = await this.getOrCreateVaultKey();
      next.key = this.encryptKey(input.apiKey, vaultKey);
    }

    await this.writeConfig(next);
    return this.getStatus();
  }

  async clearKey(): Promise<DeepSeekConfig> {
    if (this.envKey) {
      throw new AppError('CONFIG_ENV_READONLY', { statusCode: 409 });
    }
    const existing = await this.readConfig();
    if (existing) {
      const next: StoredConfig = {
        version: 1,
        model: existing.model,
        updatedAt: new Date().toISOString(),
      };
      await this.writeConfig(next);
    }
    return this.getStatus();
  }

}
