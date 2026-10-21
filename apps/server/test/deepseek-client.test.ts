import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekClient } from '../src/services/deepseek';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('DeepSeek client', () => {
  it('disables thinking mode and requests JSON output', async () => {
    let requestBody: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          model: 'deepseek-flash',
          choices: [{ message: { content: '{"svg":"<svg/>"}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const client = new DeepSeekClient();
    const result = await client.chat({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'make an icon json' }],
      maxTokens: 100,
      responseFormat: true,
      timeoutMs: 5000,
    });

    expect(result.content).toContain('svg');
    expect(requestBody).toMatchObject({
      model: 'deepseek-flash',
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    });
  });

  it('surfaces empty content with diagnostic details', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: 'deepseek-flash',
          choices: [
            {
              finish_reason: 'length',
              message: { content: '', reasoning_content: 'long reasoning' },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 8192,
            completion_tokens_details: { reasoning_tokens: 8192 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const client = new DeepSeekClient();
    await expect(
      client.chat({
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-flash',
        messages: [{ role: 'user', content: 'make an icon json' }],
        maxTokens: 8192,
        responseFormat: true,
        timeoutMs: 5000,
      }),
    ).rejects.toMatchObject({
      code: 'EMPTY_RESPONSE',
      details: expect.arrayContaining([
        'finish_reason=length',
        'reasoning_content_length=14',
      ]),
    });
  });
});
