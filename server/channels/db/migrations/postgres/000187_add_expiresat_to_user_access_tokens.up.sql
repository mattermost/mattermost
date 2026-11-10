ALTER TABLE useraccesstokens ADD COLUMN IF NOT EXISTS expiresat bigint NOT NULL DEFAULT 0;
