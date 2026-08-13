-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recaps_status_update_at ON Recaps(Status, UpdateAt);
