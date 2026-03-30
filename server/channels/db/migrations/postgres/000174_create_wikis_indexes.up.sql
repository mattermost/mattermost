-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wikis_channel_id ON Wikis(ChannelId);
