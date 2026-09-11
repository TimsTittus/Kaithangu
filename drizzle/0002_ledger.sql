-- ledger_entries is append-only (AGENTS.md 5, 6.7): reject UPDATE, DELETE and TRUNCATE.
CREATE OR REPLACE FUNCTION ledger_entries_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % rejected', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_update_delete
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_reject_mutation();
--> statement-breakpoint
-- Genesis head of the ledger hash chain: prev_hash of the first entry is 64 zeros.
INSERT INTO ledger_head (id, last_hash) VALUES (1, repeat('0', 64)) ON CONFLICT (id) DO NOTHING;
