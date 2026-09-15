-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preference_deletions_user_deleteat ON PreferenceDeletions (UserId, DeleteAt);
