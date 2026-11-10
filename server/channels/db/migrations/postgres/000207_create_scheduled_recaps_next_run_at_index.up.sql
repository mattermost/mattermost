-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_recaps_next_run_at ON ScheduledRecaps(NextRunAt);
