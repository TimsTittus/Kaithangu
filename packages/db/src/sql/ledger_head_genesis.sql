-- Genesis head of the ledger hash chain: prev_hash of the first entry is 64 zeros.
INSERT INTO ledger_head (id, last_hash) VALUES (1, repeat('0', 64)) ON CONFLICT (id) DO NOTHING;
