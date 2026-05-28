-- morph:nontransactional
-- Enforce one active wiki per channel.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_wikis_channel_id ON Wikis(ChannelId) WHERE DeleteAt = 0;
