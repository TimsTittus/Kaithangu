import { describe, expect, it } from 'vitest';
import { redactDatabaseUrl } from './index';

describe('redactDatabaseUrl', () => {
  it('masks the password and keeps the rest', () => {
    expect(redactDatabaseUrl('postgres://app:s3cret@localhost:5432/kaithangu')).toBe(
      'postgres://app:***@localhost:5432/kaithangu',
    );
  });

  it('leaves password-less URLs unchanged', () => {
    expect(redactDatabaseUrl('postgres://localhost/kaithangu')).toBe(
      'postgres://localhost/kaithangu',
    );
  });

  it('throws on non-URLs instead of echoing them', () => {
    expect(() => redactDatabaseUrl('not a url')).toThrow();
  });
});
