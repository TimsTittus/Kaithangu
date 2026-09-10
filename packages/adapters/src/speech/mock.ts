import type { SpeechAdapter } from './types';

// One MPEG-1 Layer III frame: 128 kbit/s, 44.1 kHz, mono, no CRC, no padding
// (144 × 128000 / 44100 = 417 bytes). All-zero side info and main data decode
// as silence, so a few frames make a valid, short, silent mp3.
const FRAME_HEADER = [0xff, 0xfb, 0x90, 0xc4];
const FRAME_BYTES = 417;
const SILENT_FRAMES = 10;

/** About 0.26 s of silence as mp3 bytes. */
export function silentMp3(): Uint8Array {
  const bytes = new Uint8Array(FRAME_BYTES * SILENT_FRAMES);
  for (let frame = 0; frame < SILENT_FRAMES; frame += 1) {
    bytes.set(FRAME_HEADER, frame * FRAME_BYTES);
  }
  return bytes;
}

/**
 * Offline speech adapter: a fixed transcript, silent audio, and translation
 * that tags the English text with the target locale ("[ml] <english>") so
 * machine-translated catalog entries are easy to spot.
 */
export function createMockSpeechAdapter(): SpeechAdapter {
  return {
    transcribe({ audio }) {
      return Promise.resolve({ transcript: `mock transcript (${audio.byteLength} bytes)` });
    },
    synthesize() {
      return Promise.resolve(silentMp3());
    },
    translate({ text, to }) {
      return Promise.resolve(`[${to}] ${text}`);
    },
  };
}
