/**
 * Phone numbers (AGENTS.md 5): stored as E.164 (+91XXXXXXXXXX). Only Indian
 * mobile numbers (10 digits starting 6–9) are accepted, because login OTPs and
 * job OTPs are delivered by SMS. Phone numbers are masked in logs.
 */
import { AppError } from './errors';

// Optional +91 / 0091 / 91 / 0 prefix, then a 10-digit mobile number.
const INDIAN_MOBILE = /^(?:\+91|0091|91|0)?([6-9]\d{9})$/;
const SEPARATORS = /[\s\-().]/g;

/** Normalise user input to E.164, or throw AppError('INVALID_PHONE'). */
export function normalizeIndianPhone(input: string): string {
  const match = INDIAN_MOBILE.exec(input.replace(SEPARATORS, ''));
  const national = match?.[1];
  if (national === undefined) {
    throw new AppError('INVALID_PHONE');
  }
  return `+91${national}`;
}

/** Mask every digit except the last four, e.g. "+919876543210" → "+********3210". */
export function maskPhone(phone: string): string {
  const totalDigits = phone.replace(/\D/g, '').length;
  const keep = totalDigits > 4 ? 4 : 0;
  let digitsSeen = 0;
  return phone.replace(/\d/g, (digit) => {
    digitsSeen += 1;
    return digitsSeen > totalDigits - keep ? digit : '*';
  });
}
