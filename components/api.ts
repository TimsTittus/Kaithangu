/** Minimal client for the /api/v1 JSON routes. */
export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; messageKey: string; offline?: boolean };

async function toResult<T>(response: Response): Promise<ApiResult<T>> {
  const json = (await response.json().catch(() => null)) as
    { data: T } | { error: { messageKey: string } } | null;
  if (response.ok && json !== null && 'data' in json) return { ok: true, data: json.data };
  if (json !== null && 'error' in json) return { ok: false, messageKey: json.error.messageKey };
  return { ok: false, messageKey: 'error.INTERNAL' };
}

export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, messageKey: 'common.offline', offline: true };
  }
  return toResult<T>(response);
}

export async function getJson<T>(url: string): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  } catch {
    return { ok: false, messageKey: 'common.offline', offline: true };
  }
  return toResult<T>(response);
}

/** Error messages a screen can show, keyed by messageKey. */
export type Messages = Readonly<Record<string, string>>;

export function messageFor(messages: Messages, key: string): string {
  return messages[key] ?? messages['error.INTERNAL'] ?? key;
}

/** Replace `{name}` placeholders in a raw catalog message. */
export function fill(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

/** A random Idempotency-Key (crypto.randomUUID needs a secure context). */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
