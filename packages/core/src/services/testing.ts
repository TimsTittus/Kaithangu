/**
 * In-memory implementations of the auth ports for unit tests. They follow the
 * Redis semantics of the production stores (TTL from Date.now(), so fake
 * timers control expiry). Not exported from the package root.
 */
import { randomUUID } from 'node:crypto';
import type { Locale } from '@kaithangu/i18n';
import type { SmsMessage } from '@kaithangu/adapters/sms/types';
import type {
  OtpRecord,
  OtpStore,
  RateLimiter,
  SessionUser,
  UpsertLoginInput,
  UserRepo,
} from './auth';

interface Expiring<T> {
  value: T;
  expiresAt: number;
}

export class MemoryOtpStore implements OtpStore {
  readonly entries = new Map<string, Expiring<OtpRecord>>();

  private live(phone: string): Expiring<OtpRecord> | undefined {
    const entry = this.entries.get(phone);
    if (entry !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(phone);
      return undefined;
    }
    return entry;
  }

  save(phone: string, hash: string, ttlSeconds: number): Promise<void> {
    this.entries.set(phone, {
      value: { hash, attempts: 0 },
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  recordAttempt(phone: string): Promise<OtpRecord | null> {
    const entry = this.live(phone);
    if (entry === undefined) return Promise.resolve(null);
    entry.value.attempts += 1;
    return Promise.resolve({ ...entry.value });
  }

  consume(phone: string): Promise<boolean> {
    return Promise.resolve(this.live(phone) !== undefined && this.entries.delete(phone));
  }
}

export class MemoryRateLimiter implements RateLimiter {
  readonly windows = new Map<string, Expiring<number>>();

  hit(key: string, windowSeconds: number) {
    let entry = this.windows.get(key);
    if (entry === undefined || entry.expiresAt <= Date.now()) {
      entry = { value: 0, expiresAt: Date.now() + windowSeconds * 1000 };
      this.windows.set(key, entry);
    }
    entry.value += 1;
    return Promise.resolve({
      count: entry.value,
      resetInSeconds: Math.ceil((entry.expiresAt - Date.now()) / 1000),
    });
  }
}

export class MemorySms {
  readonly sent: SmsMessage[] = [];
  failWith: Error | undefined;

  send(message: SmsMessage): Promise<void> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve();
  }

  /** The code in the most recent message to `phone`. */
  lastCode(phone: string): string {
    const message = this.sent.filter((m) => m.to === phone).at(-1);
    const code = message?.params.code;
    if (typeof code !== 'string') throw new Error(`no code sent to ${phone}`);
    return code;
  }
}

export class MemoryUserRepo implements UserRepo {
  readonly users = new Map<string, SessionUser>();
  readonly lastLogin = new Map<string, Date>();

  add(user: Partial<SessionUser> & Pick<SessionUser, 'phone' | 'role'>): SessionUser {
    const full: SessionUser = {
      id: randomUUID(),
      name: null,
      locale: null,
      sessionVersion: 0,
      stateCode: null,
      societyId: null,
      societyStateCode: null,
      institutionId: null,
      institutionStateCode: null,
      ...user,
    };
    this.users.set(full.id, full);
    return full;
  }

  upsertOnLogin(input: UpsertLoginInput) {
    let user = [...this.users.values()].find((u) => u.phone === input.phone);
    const created = user === undefined;
    user ??= this.add({
      phone: input.phone,
      role: 'customer',
      locale: input.locale,
      stateCode: input.stateCode,
    });
    this.lastLogin.set(user.id, input.at);
    return Promise.resolve({ user: { ...user }, created });
  }

  findSessionUser(userId: string) {
    const user = this.users.get(userId);
    return Promise.resolve(user === undefined ? null : { ...user });
  }

  bumpSessionVersion(userId: string) {
    const user = this.users.get(userId);
    if (user === undefined) return Promise.resolve(null);
    user.sessionVersion += 1;
    return Promise.resolve(user.sessionVersion);
  }

  setLocale(userId: string, locale: Locale) {
    const user = this.users.get(userId);
    if (user !== undefined) user.locale = locale;
    return Promise.resolve();
  }
}
