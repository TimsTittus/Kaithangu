import { describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '../context';
import { baseMimeType, createSpeechService, isSttMimeType, MAX_STT_BYTES } from './speech';

const ctx: RequestContext = {
  actor: { userId: 'u1', role: 'customer', stateCode: 'KL' },
  requestId: 'r1',
  locale: 'ml',
};

function setup(transcript = '  the tap is leaking  ') {
  const transcribe = vi.fn(() => Promise.resolve({ transcript }));
  return { transcribe, service: createSpeechService({ speech: { transcribe } }) };
}

const audio = new Uint8Array([1, 2, 3]);

describe('mime helpers', () => {
  it('strips parameters and accepts only webm and ogg audio', () => {
    expect(baseMimeType('Audio/WebM; codecs=opus')).toBe('audio/webm');
    expect(isSttMimeType('audio/ogg;codecs=opus')).toBe(true);
    expect(isSttMimeType('audio/wav')).toBe(false);
    expect(isSttMimeType('')).toBe(false);
  });
});

describe('transcribe', () => {
  it('passes the base mime type and the user locale; trims the transcript', async () => {
    const { service, transcribe } = setup();
    await expect(
      service.transcribe(ctx, { audio, mimeType: 'audio/webm;codecs=opus' }),
    ).resolves.toEqual({ transcript: 'the tap is leaking' });
    expect(transcribe).toHaveBeenCalledWith({ audio, mimeType: 'audio/webm', locale: 'ml' });
  });

  it('caps the transcript length', async () => {
    const { service } = setup('x'.repeat(5000));
    const { transcript } = await service.transcribe(ctx, { audio, mimeType: 'audio/ogg' });
    expect(transcript).toHaveLength(1000);
  });

  it('requires a signed-in user', async () => {
    const { service } = setup();
    await expect(service.transcribe(null, { audio, mimeType: 'audio/ogg' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects other formats, empty audio and more than 1 MB', async () => {
    const { service, transcribe } = setup();
    await expect(service.transcribe(ctx, { audio, mimeType: 'audio/wav' })).rejects.toMatchObject({
      code: 'UNSUPPORTED_MEDIA',
      httpStatus: 415,
    });
    await expect(
      service.transcribe(ctx, { audio: new Uint8Array(0), mimeType: 'audio/ogg' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      service.transcribe(ctx, { audio: new Uint8Array(MAX_STT_BYTES + 1), mimeType: 'audio/ogg' }),
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE', httpStatus: 413 });
    expect(transcribe).not.toHaveBeenCalled();
  });
});
