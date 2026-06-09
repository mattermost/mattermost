-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_remote_id ON sharedchannelinvitations (remoteid);
