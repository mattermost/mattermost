-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_recaps_user_delete ON ScheduledRecaps(UserId, DeleteAt);
