import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { maskPhone, normalizeIndianPhone } from './phone';

describe('normalizeIndianPhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['00919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['098-765-43210', '+919876543210'],
    ['(+91) 98765.43210', '+919876543210'],
    ['6000000000', '+916000000000'],
    ['9123456789', '+919123456789'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  it.each([
    '',
    '12345',
    '5876543210', // mobiles start 6–9
    '98765432101', // 11 digits
    '+19876543210', // wrong country code
    '+91 5876543210',
    '98765abc10',
    '+9198765432',
  ])('rejects %j with INVALID_PHONE', (input) => {
    try {
      normalizeIndianPhone(input);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('INVALID_PHONE');
    }
  });
});

describe('maskPhone', () => {
  it('keeps only the last four digits', () => {
    expect(maskPhone('+919876543210')).toBe('+********3210');
    expect(maskPhone('98765 43210')).toBe('*****' + ' ' + '*3210');
  });

  it('masks everything when there are four digits or fewer', () => {
    expect(maskPhone('1234')).toBe('****');
    expect(maskPhone('+91')).toBe('+**');
    expect(maskPhone('')).toBe('');
  });
});
