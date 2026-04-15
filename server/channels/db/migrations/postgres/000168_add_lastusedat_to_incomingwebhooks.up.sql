ALTER TABLE incomingwebhooks ADD COLUMN IF NOT EXISTS lastusedat bigint NOT NULL DEFAULT 0;
