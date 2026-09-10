import { describe, expect, it } from 'vitest';
import { clamp } from './index';

describe('clamp', () => {
  it('keeps values inside the range and bounds values outside it', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(7, 0, 1)).toBe(1);
  });

  it('rejects an inverted range', () => {
    expect(() => clamp(1, 2, 0)).toThrow(RangeError);
  });
});
