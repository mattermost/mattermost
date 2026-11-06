-- NULL means no rules.
ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS bounds jsonb NULL;

-- '' means mutable. A constant default keeps this a metadata-only change, so
-- Postgres doesn't rewrite the table.
ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS mutability varchar(32) NOT NULL DEFAULT '';
