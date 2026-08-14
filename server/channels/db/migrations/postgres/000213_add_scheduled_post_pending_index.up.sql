-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledposts_pending_scheduled_at_id
    ON scheduledposts (scheduledat DESC, id)
    WHERE errorcode = '';
