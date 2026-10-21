import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigVault } from '../src/services/config-vault';

const cleanups: string[] = [];

async function makeVault(options?: { envKey?: string | null; dir?: string }) {
  const dir = options?.dir ?? (await mkdtemp(join(tmpdir(), 'aiicon-vault-')));
  if (!options?.dir) cleanups.push(dir);
  return {
    dir,
    vault: new ConfigVault({
      dir,
      envKey: options?.envKey ?? null,
      defaultModel: 'deepseek-flash',
      baseUrl: 'https://api.deepseek.com',
    }),
  };
}

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('ConfigVault', () => {
  it('starts unconfigured and persists encrypted keys', async () => {
    const { dir, vault } = await makeVault();
    const initial = await vault.getStatus();
    expect(initial.configured).toBe(false);
    expect(initial.source).toBe('none');

    const saved = await vault.save({ apiKey: 'sk-test-secret-12345678', model: 'deepseek-flash' });
    expect(saved.configured).toBe(true);
    expect(saved.source).toBe('file');
    expect(saved.maskedKey).toContain('••••');
    expect(saved.maskedKey).not.toContain('secret');

    expect(await vault.getApiKey()).toBe('sk-test-secret-12345678');
    expect(await vault.getModel()).toBe('deepseek-flash');

    const configRaw = await readFile(join(dir, 'config.json'), 'utf8');
    expect(configRaw).not.toContain('sk-test-secret-12345678');
    expect(configRaw).toContain('ciphertext');
  });

  it('preserves a stored key when updating only the model', async () => {
    const { vault } = await makeVault();
    await vault.save({ apiKey: 'sk-preserve-12345678', model: 'deepseek-flash' });
    const updated = await vault.save({ model: 'deepseek-v4-pro' });
    expect(updated.model).toBe('deepseek-v4-pro');
    expect(await vault.getApiKey()).toBe('sk-preserve-12345678');
  });

  it('clears only the key while retaining the model', async () => {
    const { vault } = await makeVault();
    await vault.save({ apiKey: 'sk-clear-12345678', model: 'deepseek-v4-pro' });
    const cleared = await vault.clearKey();
    expect(cleared.configured).toBe(false);
    expect(cleared.model).toBe('deepseek-v4-pro');
  });

  it('uses the environment key first and refuses file key writes', async () => {
    const { vault } = await makeVault({ envKey: 'sk-env-12345678' });
    const status = await vault.getStatus();
    expect(status.source).toBe('env');
    expect(status.configured).toBe(true);
    expect(await vault.getApiKey()).toBe('sk-env-12345678');
    await expect(
      vault.save({ apiKey: 'sk-file-12345678', model: 'deepseek-flash' }),
    ).rejects.toMatchObject({ code: 'CONFIG_ENV_READONLY' });
    await expect(vault.clearKey()).rejects.toMatchObject({ code: 'CONFIG_ENV_READONLY' });
  });

  it('loads model changes across vault instances', async () => {
    const { dir, vault } = await makeVault();
    await vault.save({ apiKey: 'sk-reload-12345678', model: 'custom-model' });
    const second = new ConfigVault({
      dir,
      envKey: null,
      defaultModel: 'deepseek-flash',
      baseUrl: 'https://api.deepseek.com',
    });
    expect(await second.getModel()).toBe('custom-model');
    expect(await second.getApiKey()).toBe('sk-reload-12345678');
  });
});
