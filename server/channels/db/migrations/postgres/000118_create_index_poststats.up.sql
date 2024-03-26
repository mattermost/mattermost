-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_poststats_userid ON poststats(userid)