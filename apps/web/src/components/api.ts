/** Minimal client for the /api/v1 JSON routes used by the sign-in screens. */
export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; messageKey: string; offline?: boolean };

export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, messageKey: 'common.offline', offline: true };
  }
  const json = (await response.json().catch(() => null)) as
    { data: T } | { error: { messageKey: string } } | null;
  if (response.ok && json !== null && 'data' in json) return { ok: true, data: json.data };
  if (json !== null && 'error' in json) return { ok: false, messageKey: json.error.messageKey };
  return { ok: false, messageKey: 'error.INTERNAL' };
}

/** Error messages the sign-in screens can show, keyed by messageKey. */
export type Messages = Readonly<Record<string, string>>;

export function messageFor(messages: Messages, key: string): string {
  return messages[key] ?? messages['error.INTERNAL'] ?? key;
}
