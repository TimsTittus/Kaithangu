import { describe, expect, it, vi } from 'vitest';
import { isNotConfiguredError } from '../sms/types';
import { createSpeechAdapter, silentMp3 } from './index';
import { createRealSpeechAdapter } from './real';

describe('mock speech adapter', () => {
  const speech = createSpeechAdapter({ env: {} });

  it('transcribes to a fixed text, translates with a locale tag', async () => {
    await expect(
      speech.transcribe({ audio: new Uint8Array(7), mimeType: 'audio/webm', locale: 'ml' }),
    ).resolves.toEqual({ transcript: 'mock transcript (7 bytes)' });
    await expect(speech.translate({ text: 'Next', from: 'en', to: 'ml' })).resolves.toBe(
      '[ml] Next',
    );
  });

  it('synthesizes a silent mp3 made of MPEG-1 Layer III frames', async () => {
    const bytes = await speech.synthesize({ text: 'Next', locale: 'en' });
    expect(bytes).toEqual(silentMp3());
    expect(bytes.length % 417).toBe(0);
    for (let offset = 0; offset < bytes.length; offset += 417) {
      expect([...bytes.slice(offset, offset + 4)]).toEqual([0xff, 0xfb, 0x90, 0xc4]);
    }
  });
});

function fakeFetch(body: unknown, status = 200) {
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe('real (Sarvam) speech adapter', () => {
  it('is selected by SPEECH_MODE and needs an API key', async () => {
    const speech = createSpeechAdapter({ env: { SPEECH_MODE: 'real' } });
    const error: unknown = await speech
      .translate({ text: 'a', from: 'en', to: 'hi' })
      .catch((e: unknown) => e);
    expect(isNotConfiguredError(error)).toBe(true);
  });

  it('translates with language codes and the subscription key', async () => {
    const fetch = fakeFetch({ translated_text: 'अगला' });
    const speech = createRealSpeechAdapter({ apiKey: 'k', fetch });
    await expect(speech.translate({ text: 'Next', from: 'en', to: 'hi' })).resolves.toBe('अगला');
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.sarvam.ai/translate');
    expect(init?.headers).toMatchObject({ 'api-subscription-key': 'k' });
    expect(JSON.parse(init?.body as string)).toEqual({
      input: 'Next',
      source_language_code: 'en-IN',
      target_language_code: 'hi-IN',
    });
  });

  it('decodes synthesized audio and sends recordings as multipart', async () => {
    const tts = createRealSpeechAdapter({
      apiKey: 'k',
      fetch: fakeFetch({ audios: [Buffer.from([1, 2, 3]).toString('base64')] }),
    });
    await expect(tts.synthesize({ text: 'a', locale: 'ta' })).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );

    const fetch = fakeFetch({ transcript: 'hello' });
    const stt = createRealSpeechAdapter({ apiKey: 'k', fetch });
    await expect(
      stt.transcribe({ audio: new Uint8Array([9]), mimeType: 'audio/ogg', locale: 'ml' }),
    ).resolves.toEqual({ transcript: 'hello' });
    const form = fetch.mock.calls[0]?.[1]?.body as FormData;
    expect(form.get('language_code')).toBe('ml-IN');
    expect((form.get('file') as File).name).toBe('audio.ogg');
  });

  it('fails on HTTP errors and unexpected bodies', async () => {
    const failing = createRealSpeechAdapter({ apiKey: 'k', fetch: fakeFetch({}, 500) });
    await expect(failing.translate({ text: 'a', from: 'en', to: 'ml' })).rejects.toThrow(/500/);
    const malformed = createRealSpeechAdapter({ apiKey: 'k', fetch: fakeFetch({ nope: 1 }) });
    await expect(malformed.translate({ text: 'a', from: 'en', to: 'ml' })).rejects.toThrow();
  });
});
