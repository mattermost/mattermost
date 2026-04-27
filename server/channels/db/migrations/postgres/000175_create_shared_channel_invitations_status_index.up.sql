-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_status ON sharedchannelinvitations (status);
