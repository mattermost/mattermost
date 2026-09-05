-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_channel_id ON sharedchannelinvitations (channelid);
