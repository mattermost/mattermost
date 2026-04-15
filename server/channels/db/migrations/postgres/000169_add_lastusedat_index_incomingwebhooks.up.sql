-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incoming_webhook_last_used_at ON incomingwebhooks (lastusedat);
