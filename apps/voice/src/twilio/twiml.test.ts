import { describe, expect, it } from 'vitest';
import type { VoiceTurn } from '@kaithangu/core';
import { buildTwiml } from './twiml';

const ACTION = 'https://voice.example.com/twilio/voice/turn/abc';

describe('buildTwiml', () => {
  it('renders Play + Hangup when the turn ends', () => {
    const turn: VoiceTurn = { prompts: [], expect: null, actions: [], end: true };
    const xml = buildTwiml(turn, ['https://voice.example.com/audio/1.wav'], ACTION);
    expect(xml).toContain('<Play>https://voice.example.com/audio/1.wav</Play>');
    expect(xml).toContain('<Hangup/>');
    expect(xml).not.toContain('<Gather');
    expect(xml).not.toContain('<Record');
  });

  it('renders a Gather with numDigits for dtmf expect', () => {
    const turn: VoiceTurn = {
      prompts: [],
      expect: { mode: 'dtmf', dtmfDigits: 6, maxSeconds: 20 },
      actions: [],
      end: false,
    };
    const xml = buildTwiml(turn, ['https://voice.example.com/audio/2.wav'], ACTION);
    expect(xml).toContain('<Gather input="dtmf" numDigits="6" timeout="20" action="https://voice.example.com/twilio/voice/turn/abc" method="POST">');
    expect(xml).toContain('<Play>https://voice.example.com/audio/2.wav</Play>');
    expect(xml).toContain('</Gather>');
  });

  it('renders Play then Record for speech expect', () => {
    const turn: VoiceTurn = { prompts: [], expect: { mode: 'speech', maxSeconds: 15 }, actions: [], end: false };
    const xml = buildTwiml(turn, ['https://voice.example.com/audio/3.wav'], ACTION);
    expect(xml.indexOf('<Play>')).toBeLessThan(xml.indexOf('<Record'));
    expect(xml).toContain('maxLength="15"');
    expect(xml).toContain('timeout="2"');
    expect(xml).toContain('playBeep="false"');
    expect(xml).toContain('trim="trim-silence"');
  });

  it('escapes special characters in the action URL and play URLs', () => {
    const turn: VoiceTurn = { prompts: [], expect: null, actions: [], end: true };
    const xml = buildTwiml(turn, ['https://x/a?b=1&c=2'], 'https://x/action?a=1&b=2');
    expect(xml).toContain('<Play>https://x/a?b=1&amp;c=2</Play>');
  });
});
