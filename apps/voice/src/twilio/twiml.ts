/**
 * TwiML generation from a VoiceTurn (Phase 7 spec): prompts play as cached
 * TTS audio, and turn.expect decides the input verb — <Gather input="dtmf">
 * for dtmf, <Record> for speech. Both post back to the same per-session turn
 * webhook; Twilio calls it on timeout too (Gather with no Digits, Record
 * always calls its action), so a caller's silence naturally becomes the next
 * `timeout` VoiceEvent without any extra TwiML.
 */
import type { VoiceTurn } from '@kaithangu/core';

const RECORD_MAX_LENGTH_SECONDS = 15;
const RECORD_SILENCE_TIMEOUT_SECONDS = 2;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function playTags(audioUrls: string[]): string {
  return audioUrls.map((url) => `<Play>${escapeXml(url)}</Play>`).join('');
}

export function buildTwiml(turn: VoiceTurn, promptAudioUrls: string[], actionUrl: string): string {
  const plays = playTags(promptAudioUrls);

  if (turn.end || !turn.expect) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${plays}<Hangup/></Response>`;
  }

  const action = escapeXml(actionUrl);

  if (turn.expect.mode === 'speech') {
    return (
      `<?xml version="1.0" encoding="UTF-8"?><Response>${plays}` +
      `<Record maxLength="${RECORD_MAX_LENGTH_SECONDS}" timeout="${RECORD_SILENCE_TIMEOUT_SECONDS}" ` +
      `playBeep="false" trim="trim-silence" action="${action}" method="POST"/>` +
      `</Response>`
    );
  }

  // 'dtmf' and 'speech_or_dtmf' both gather keypad input here; combined
  // speech+dtmf recognition isn't wired up (no current flow needs it).
  const numDigits = turn.expect.dtmfDigits ?? 1;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Gather input="dtmf" numDigits="${numDigits}" timeout="${turn.expect.maxSeconds}" action="${action}" method="POST">` +
    `${plays}` +
    `</Gather>` +
    `</Response>`
  );
}
