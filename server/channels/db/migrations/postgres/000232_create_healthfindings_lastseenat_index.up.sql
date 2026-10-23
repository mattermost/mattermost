-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_healthfindings_lastseenat ON healthfindings (lastseenat);
