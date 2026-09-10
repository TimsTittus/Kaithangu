import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Raw SQL lives in src/sql (AGENTS.md 3); drizzle applies it through custom
// migrations. These tests fail if the two copies drift apart.
const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('custom migrations match src/sql', () => {
  it('0000_extensions is src/sql/000_extensions.sql', () => {
    expect(read('../../drizzle/0000_extensions.sql')).toBe(read('./000_extensions.sql'));
  });

  it('0002_ledger is the immutability trigger followed by the genesis head row', () => {
    expect(read('../../drizzle/0002_ledger.sql')).toBe(
      `${read('./ledger_immutability.sql')}--> statement-breakpoint\n${read('./ledger_head_genesis.sql')}`,
    );
  });
});
