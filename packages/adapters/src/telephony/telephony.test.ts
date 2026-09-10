import { describe, expect, it, vi } from 'vitest';
import { isNotConfiguredError } from '../notConfigured';
import { createTelephonyAdapter } from './index';
import { createRealTelephonyAdapter } from './real';

describe('mock telephony adapter', () => {
  it('places calls with fake SIDs and fetches a silent recording', async () => {
    const telephony = createTelephonyAdapter({ env: {} });
    const { callSid } = await telephony.placeCall({ to: '+919999999999', url: 'https://x/twiml' });
    expect(callSid).toMatch(/^CAmock/);
    const { audio, mimeType } = await telephony.fetchRecording('https://x/recording');
    expect(mimeType).toBe('audio/x-wav');
    expect(audio.byteLength).toBeGreaterThan(0);
    await expect(telephony.deleteRecording('https://x/recording')).resolves.toBeUndefined();
  });
});

function fakeFetch(body: unknown, status = 200) {
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe('real (Twilio) telephony adapter', () => {
  it('is selected by TELEPHONY_MODE and needs credentials', async () => {
    const telephony = createTelephonyAdapter({ env: { TELEPHONY_MODE: 'real' } });
    const error: unknown = await telephony
      .placeCall({ to: '+919999999999', url: 'https://x/twiml' })
      .catch((e: unknown) => e);
    expect(isNotConfiguredError(error)).toBe(true);
  });

  it('places a call with Basic auth and form-encoded params', async () => {
    const fetch = fakeFetch({ sid: 'CA123' });
    const telephony = createRealTelephonyAdapter({
      accountSid: 'AC1',
      authToken: 'secret',
      fromNumber: '+911234567890',
      fetch,
    });
    const { callSid } = await telephony.placeCall({
      to: '+919999999999',
      url: 'https://voice.example/twilio/voice/outbound/abc',
      statusCallbackUrl: 'https://voice.example/twilio/voice/status',
    });
    expect(callSid).toBe('CA123');
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Calls.json');
    expect(init?.headers).toMatchObject({ authorization: `Basic ${Buffer.from('AC1:secret').toString('base64')}` });
    const body = new URLSearchParams(init?.body as string);
    expect(body.get('To')).toBe('+919999999999');
    expect(body.get('From')).toBe('+911234567890');
    expect(body.get('StatusCallback')).toBe('https://voice.example/twilio/voice/status');
  });

  it('retries fetching a recording until it is ready', async () => {
    let calls = 0;
    const fetch = vi.fn(() => {
      calls += 1;
      if (calls < 2) return Promise.resolve(new Response('', { status: 404 }));
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/x-wav' } }),
      );
    });
    const telephony = createRealTelephonyAdapter({
      accountSid: 'AC1',
      authToken: 'secret',
      fromNumber: '+911234567890',
      fetch,
    });
    const { audio, mimeType } = await telephony.fetchRecording('https://api.twilio.com/recording.wav');
    expect(mimeType).toBe('audio/x-wav');
    expect([...audio]).toEqual([1, 2, 3]);
    expect(calls).toBe(2);
  });
});
