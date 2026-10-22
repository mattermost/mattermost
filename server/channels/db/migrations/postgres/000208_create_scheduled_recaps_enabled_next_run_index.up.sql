-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_recaps_enabled_next_run ON ScheduledRecaps(Enabled, DeleteAt, NextRunAt);
