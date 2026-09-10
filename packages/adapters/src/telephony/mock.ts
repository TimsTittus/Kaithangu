import { randomUUID } from 'node:crypto';
import type { TelephonyAdapter } from './types';

/** Offline telephony adapter: fake call SIDs, no network, silent recording as WAV. */
export function createMockTelephonyAdapter(): TelephonyAdapter {
  return {
    placeCall() {
      return Promise.resolve({ callSid: `CAmock${randomUUID().replace(/-/g, '')}` });
    },
    fetchRecording() {
      // 44-byte canonical RIFF/WAVE header for a zero-sample file.
      const header = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'binary');
      return Promise.resolve({ audio: new Uint8Array(header), mimeType: 'audio/x-wav' });
    },
    deleteRecording() {
      return Promise.resolve();
    },
  };
}
