-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_status_last_activity_at ON status(lastactivityat);
