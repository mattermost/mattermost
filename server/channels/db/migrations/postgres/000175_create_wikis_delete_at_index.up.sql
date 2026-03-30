-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wikis_channel_id_delete_at ON Wikis(ChannelId) WHERE DeleteAt = 0;
