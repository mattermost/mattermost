DROP INDEX CONCURRENTLY IF EXISTS idx_scheduled_recaps_user_delete;
DROP INDEX CONCURRENTLY IF EXISTS idx_scheduled_recaps_enabled_next_run;
DROP INDEX CONCURRENTLY IF EXISTS idx_scheduled_recaps_next_run_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_scheduled_recaps_user_id;
DROP TABLE IF EXISTS ScheduledRecaps;
