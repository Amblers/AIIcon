import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GenerateRequest } from '@aiicon/shared';
import { ConfigVault } from '../src/services/config-vault';
import { DeepSeekClient, type ChatCompletionOptions } from '../src/services/deepseek';
import { GenerationService } from '../src/services/generation-service';

const cleanups: string[] = [];

async function setup(responses: string[] | (() => Promise<string>)) {
  const dir = await mkdtemp(join(tmpdir(), 'aiicon-gen-'));
  cleanups.push(dir);
  const vault = new ConfigVault({
    dir,
    envKey: null,
    defaultModel: 'deepseek-flash',
    baseUrl: 'https://example.invalid',
  });
  await vault.save({ apiKey: 'sk-test-generation-12345678', model: 'deepseek-flash' });
  let calls = 0;
  const client = {
    async chat(options: ChatCompletionOptions) {
      const content =
        typeof responses === 'function'
          ? await responses()
          : (responses[calls] ?? responses[responses.length - 1] ?? '');
      calls += 1;
      expect(options.messages.length).toBeGreaterThan(0);
      return {
        content,
        model: 'deepseek-flash',
        latencyMs: 12,
        usage: { promptTokens: 10, completionTokens: 20 },
      };
    },
  } as unknown as DeepSeekClient;
  const service = new GenerationService({ vault, client, timeoutMs: 1000 });
  return { service, getCalls: () => calls };
}

const request: GenerateRequest = {
  content: '加号',
  templateId: 'line',
  keywords: ['极简'],
  primaryColor: '#2563EB',
  backgroundColor: null,
  roundedRadiusPx: 0,
};

const validSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M96 256H416M256 96V416" fill="none" stroke="#2563EB" stroke-width="30" stroke-linecap="round"/></svg>';
const invalidSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M96 96H416V416H96Z" fill="#2563EB"/></svg>';

function modelJson(svg: string): string {
  return JSON.stringify({
    svg,
    palette: { primary: '#2563EB', background: null, supporting: [] },
    alt: '加号图标',
  });
}

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('GenerationService', () => {
  it('returns a validated result on the first attempt', async () => {
    const { service, getCalls } = await setup([modelJson(validSvg)]);
    const result = await service.generate(request, 'req-test-1');
    expect(result.svg).toContain('<svg');
    expect(result.palette.primary).toBe('#2563EB');
    expect(result.attempts).toBe(1);
    expect(getCalls()).toBe(1);
  });

  it('repairs an invalid first SVG once and reports attempts', async () => {
    const { service, getCalls } = await setup([modelJson(invalidSvg), modelJson(validSvg)]);
    const result = await service.generate(request, 'req-test-2');
    expect(result.attempts).toBe(2);
    expect(getCalls()).toBe(2);
  });

  it('fails after two invalid outputs without a third call', async () => {
    const { service, getCalls } = await setup([
      modelJson(invalidSvg),
      modelJson(invalidSvg),
    ]);
    await expect(service.generate(request, 'req-test-3')).rejects.toMatchObject({
      code: 'GENERATION_REJECTED',
    });
    expect(getCalls()).toBe(2);
  });

  it('returns a structured parse failure after a second unusable JSON response', async () => {
    const { service, getCalls } = await setup(['not json', 'still not json']);
    await expect(service.generate(request, 'req-test-4')).rejects.toMatchObject({
      code: 'GENERATION_REJECTED',
      retryable: true,
    });
    expect(getCalls()).toBe(2);
  });
});
