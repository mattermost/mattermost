ALTER TABLE useraccesstokens ADD COLUMN IF NOT EXISTS expiresat bigint NOT NULL DEFAULT 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_useraccesstokens_expiresat
    ON useraccesstokens (expiresat)
    WHERE expiresat > 0;
