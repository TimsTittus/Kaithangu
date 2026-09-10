import { describe, expect, it } from 'vitest';
import { maskPhones } from './mask';

describe('maskPhones', () => {
  it('masks E.164 numbers but keeps the last four digits', () => {
    expect(maskPhones('call +919876543210 now')).toBe('call +********3210 now');
  });

  it('masks several numbers and leaves other text alone', () => {
    expect(maskPhones('+919876543210,+14155550123 id=42')).toBe('+********3210,+*******0123 id=42');
  });

  it('ignores short digit runs', () => {
    expect(maskPhones('+1234 and 9876543210')).toBe('+1234 and 9876543210');
  });
});
