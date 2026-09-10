/**
 * TTS caching (Phase 7 spec): audio for a given (locale, voice, text) is
 * synthesized once and cached at STORAGE_DIR/tts/{sha256(locale+voice+text)}.wav,
 * served back at GET /audio/:hash.wav. The speech adapter returns mp3 bytes
 * (see @kaithangu/adapters/speech/real.ts); the `.wav` filename follows the
 * spec's naming, but Twilio identifies the format from the response's
 * Content-Type, not the URL extension, so the mismatch is cosmetic only.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpeechAdapter } from '@kaithangu/adapters/speech/types';
import type { Locale } from '@kaithangu/i18n';

const VOICE_NAME = 'default';

export function ttsHash(locale: Locale, text: string): string {
  return createHash('sha256').update(`${locale}:${VOICE_NAME}:${text}`).digest('hex');
}

export interface TtsCache {
  /** Synthesizes (if not already cached) and returns the cache hash. */
  synthesizeAndCache(locale: Locale, text: string): Promise<string>;
  /** Reads cached audio bytes by hash, or null if not cached. */
  read(hash: string): Uint8Array | null;
}

export function createTtsCache(speech: Pick<SpeechAdapter, 'synthesize'>, storageDir: string): TtsCache {
  const ttsDir = join(storageDir, 'tts');
  mkdirSync(ttsDir, { recursive: true });

  function pathFor(hash: string): string {
    return join(ttsDir, `${hash}.wav`);
  }

  return {
    async synthesizeAndCache(locale, text) {
      const hash = ttsHash(locale, text);
      const path = pathFor(hash);
      if (!existsSync(path)) {
        const audio = await speech.synthesize({ text, locale });
        writeFileSync(path, audio);
      }
      return hash;
    },

    read(hash) {
      const path = pathFor(hash);
      return existsSync(path) ? new Uint8Array(readFileSync(path)) : null;
    },
  };
}
