// E.164-looking numbers: '+' then 8–15 digits. Keeps the last 4 digits.
const PHONE_PATTERN = /\+\d{4,11}(\d{4})(?!\d)/g;

/** Mask phone numbers inside free text, e.g. "+919876543210" → "+********3210". */
export function maskPhones(text: string): string {
  return text.replace(PHONE_PATTERN, (match, lastFour: string) => {
    return `+${'*'.repeat(match.length - 1 - lastFour.length)}${lastFour}`;
  });
}
