/**
 * Twilio request signature validation (X-Twilio-Signature).
 *
 * Twilio signs `url + sorted(key+value for each POST param, no separators)`
 * with HMAC-SHA1 under the auth token, base64-encoded. `url` must be the
 * exact URL Twilio was configured to call — built from VOICE_PUBLIC_URL plus
 * the original request path and query string, never the internal host a
 * reverse proxy may present to the app.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Readonly<Record<string, string>>,
): string {
  const signedPayload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join('');
  return createHmac('sha1', authToken).update(signedPayload, 'utf8').digest('base64');
}

export function isValidTwilioSignature(
  authToken: string,
  url: string,
  params: Readonly<Record<string, string>>,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = computeTwilioSignature(authToken, url, params);
  const expectedBuf = Buffer.from(expected, 'base64');
  const actualBuf = Buffer.from(signature, 'base64');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
