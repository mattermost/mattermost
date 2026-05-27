ALTER TABLE incomingwebhooks ADD COLUMN IF NOT EXISTS lastused bigint NOT NULL DEFAULT 0;
