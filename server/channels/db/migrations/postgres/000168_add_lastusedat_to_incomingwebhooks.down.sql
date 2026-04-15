DROP INDEX IF EXISTS idx_incoming_webhook_last_used_at;

ALTER TABLE incomingwebhooks DROP COLUMN IF EXISTS lastusedat;
