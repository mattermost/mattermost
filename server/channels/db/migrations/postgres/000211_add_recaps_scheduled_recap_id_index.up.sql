-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recaps_scheduled_recap_id ON Recaps(ScheduledRecapId);
