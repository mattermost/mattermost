ALTER TABLE incomingwebhooks ADD COLUMN IF NOT EXISTS lastusedat bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_incoming_webhook_last_used_at ON incomingwebhooks (lastusedat);
