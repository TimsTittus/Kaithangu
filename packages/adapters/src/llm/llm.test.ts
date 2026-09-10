import { describe, expect, it, vi } from 'vitest';
import { isNotConfiguredError } from '../sms/types';
import { createLlmAdapter } from './index';
import { createRealLlmAdapter } from './real';

describe('mock llm adapter', () => {
  it('always returns a fixed not-understood JSON payload', async () => {
    const llm = createLlmAdapter({ env: {} });
    const text = await llm.complete({ system: 'sys', prompt: 'anything' });
    expect(JSON.parse(text)).toEqual({
      tradeCode: null,
      confidence: 0,
      urgency: null,
      timePreference: null,
      problemSummaryEn: '',
      safetyRisk: false,
      outOfScope: false,
    });
  });
});

function fakeFetch(body: unknown, status = 200) {
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe('real (Gemini) llm adapter', () => {
  it('is selected by LLM_MODE and needs an API key', async () => {
    const llm = createLlmAdapter({ env: { LLM_MODE: 'real' } });
    const error: unknown = await llm.complete({ system: 's', prompt: 'p' }).catch((e: unknown) => e);
    expect(isNotConfiguredError(error)).toBe(true);
  });

  it('posts systemInstruction + contents and extracts the text', async () => {
    const fetch = fakeFetch({
      candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
    });
    const llm = createRealLlmAdapter({ apiKey: 'k', fetch });
    await expect(llm.complete({ system: 'be terse', prompt: 'hello' })).resolves.toBe(
      '{"ok":true}',
    );
    const [rawUrl, init] = fetch.mock.calls[0] ?? [];
    const urlStr =
      typeof rawUrl === 'string'
        ? rawUrl
        : rawUrl instanceof URL
          ? rawUrl.toString()
          : '';
    expect(urlStr).toContain('generativelanguage.googleapis.com');
    expect(urlStr).toContain('key=k');
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body['systemInstruction']).toEqual({ parts: [{ text: 'be terse' }] });
    expect(body['contents']).toEqual([{ role: 'user', parts: [{ text: 'hello' }] }]);
  });
});