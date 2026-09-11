/**
 * Sarvam AI speech adapter (speech-to-text, text-to-speech, translate).
 * Every response is validated with zod before use (AGENTS.md 4.3).
 */
import { z } from 'zod';
import { NotConfiguredError } from '../notConfigured';
import { SPEECH_LANGUAGE_CODES, type SpeechAdapter } from './types';

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const REQUEST_TIMEOUT_MS = 30_000;

const transcriptResponse = z.object({ transcript: z.string() });
const speechResponse = z.object({ audios: z.array(z.string().min(1)).min(1) });
const translateResponse = z.object({ translated_text: z.string() });

const FILE_EXTENSIONS: Readonly<Record<string, string>> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

export interface RealSpeechOptions {
  apiKey: string | undefined;
  fetch?: typeof fetch;
}

export function createRealSpeechAdapter({
  apiKey,
  fetch: fetchImpl = fetch,
}: RealSpeechOptions): SpeechAdapter {
  async function post<T extends z.ZodType>(
    path: string,
    body: FormData | string,
    schema: T,
  ): Promise<z.output<T>> {
    if (apiKey === undefined || apiKey === '') throw new NotConfiguredError('speech');
    const headers: Record<string, string> = { 'api-subscription-key': apiKey };
    if (typeof body === 'string') headers['content-type'] = 'application/json';
    const response = await fetchImpl(`${SARVAM_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`sarvam ${path} failed with HTTP ${response.status}`);
    }
    return schema.parse(await response.json());
  }

  return {
    async transcribe({ audio, mimeType, locale }) {
      const form = new FormData();
      const extension = FILE_EXTENSIONS[mimeType] ?? 'bin';
      form.append('file', new Blob([audio.slice()], { type: mimeType }), `audio.${extension}`);
      form.append('language_code', SPEECH_LANGUAGE_CODES[locale]);
      const { transcript } = await post('/speech-to-text', form, transcriptResponse);
      return { transcript };
    },

    async synthesize({ text, locale }) {
      const { audios } = await post(
        '/text-to-speech',
        JSON.stringify({
          text,
          target_language_code: SPEECH_LANGUAGE_CODES[locale],
          output_audio_codec: 'mp3',
        }),
        speechResponse,
      );
      return new Uint8Array(Buffer.from(audios[0] ?? '', 'base64'));
    },

    async translate({ text, from, to }) {
      const { translated_text: translated } = await post(
        '/translate',
        JSON.stringify({
          input: text,
          source_language_code: SPEECH_LANGUAGE_CODES[from],
          target_language_code: SPEECH_LANGUAGE_CODES[to],
        }),
        translateResponse,
      );
      return translated;
    },
  };
}
