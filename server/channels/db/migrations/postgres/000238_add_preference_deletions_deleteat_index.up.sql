-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preference_deletions_deleteat ON PreferenceDeletions (DeleteAt);
