/**
 * Speech-to-text for the booking problem box (Phase 5). Any signed-in user;
 * audio is at most 1 MB of audio/webm or audio/ogg (about 30 s of Opus).
 * Audio is passed to the speech adapter and never stored.
 */
import type { SpeechAdapter } from '@/lib/adapters/speech/types';
import { requireRole } from '../authz';
import { ROLES, type RequestContext } from '../context';
import { AppError } from '../errors';

export const MAX_STT_BYTES = 1_048_576;
export const STT_MIME_TYPES = ['audio/webm', 'audio/ogg'] as const;
export const MAX_TRANSCRIPT_LENGTH = 1000;

/** `audio/webm;codecs=opus` → `audio/webm`. */
export function baseMimeType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

export function isSttMimeType(contentType: string): boolean {
  return (STT_MIME_TYPES as readonly string[]).includes(baseMimeType(contentType));
}

export interface TranscribeRequest {
  audio: Uint8Array;
  mimeType: string;
}

export function createSpeechService({ speech }: { speech: Pick<SpeechAdapter, 'transcribe'> }) {
  return {
    async transcribe(
      ctx: RequestContext | null,
      { audio, mimeType }: TranscribeRequest,
    ): Promise<{ transcript: string }> {
      const signed = requireRole(ctx, ROLES);
      if (!isSttMimeType(mimeType)) throw new AppError('UNSUPPORTED_MEDIA');
      if (audio.byteLength > MAX_STT_BYTES) throw new AppError('PAYLOAD_TOO_LARGE');
      if (audio.byteLength === 0) {
        throw new AppError('VALIDATION_FAILED', undefined, undefined, { reason: 'empty_audio' });
      }
      const { transcript } = await speech.transcribe({
        audio,
        mimeType: baseMimeType(mimeType),
        locale: signed.locale,
      });
      return { transcript: transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH) };
    },
  };
}

export type SpeechService = ReturnType<typeof createSpeechService>;
