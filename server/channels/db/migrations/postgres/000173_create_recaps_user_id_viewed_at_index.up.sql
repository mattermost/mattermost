-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recaps_user_id_viewed_at ON Recaps(UserId, ViewedAt);
