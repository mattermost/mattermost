-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userplatformnotifications_userid_recordedat ON userplatformnotifications (userid, recordedat DESC);
