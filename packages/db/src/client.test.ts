import { describe, expect, it } from 'vitest';
import { isLocalDatabase, isTransactionPooler, sessionModeUrl } from './client';

describe('sessionModeUrl', () => {
  it('moves a Supabase transaction-pooler URL to the session port', () => {
    expect(sessionModeUrl('postgresql://u:p@aws-0-xx.pooler.supabase.com:6543/postgres')).toBe(
      'postgresql://u:p@aws-0-xx.pooler.supabase.com:5432/postgres',
    );
  });

  it('leaves session, direct and local URLs unchanged', () => {
    for (const url of [
      'postgresql://u:p@aws-0-xx.pooler.supabase.com:5432/postgres',
      'postgresql://u:p@db.example.supabase.co:5432/postgres',
      'postgres://u:p@localhost:6543/kaithangu',
    ]) {
      expect(sessionModeUrl(url)).toBe(url);
    }
  });
});

// Example hosts only; no real credentials.
describe('connection helpers', () => {
  it('detects the Supabase transaction pooler port', () => {
    expect(isTransactionPooler('postgresql://u:p@pooler.example.com:6543/postgres')).toBe(true);
    expect(isTransactionPooler('postgresql://u:p@pooler.example.com:5432/postgres')).toBe(false);
  });

  it('recognises local databases only', () => {
    expect(isLocalDatabase('postgres://u:p@localhost:5434/kaithangu')).toBe(true);
    expect(isLocalDatabase('postgres://u:p@127.0.0.1/kaithangu')).toBe(true);
    expect(isLocalDatabase('postgres://u:p@[::1]:5432/kaithangu')).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@db.example.supabase.co:5432/postgres')).toBe(false);
  });
});
