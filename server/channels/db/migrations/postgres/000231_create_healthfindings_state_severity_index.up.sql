-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_healthfindings_state_severity ON healthfindings (state, severity);
