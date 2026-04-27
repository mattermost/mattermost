-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_channel_id ON sharedchannelinvitations (channelid);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_remote_id ON sharedchannelinvitations (remoteid);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_status ON sharedchannelinvitations (status);
