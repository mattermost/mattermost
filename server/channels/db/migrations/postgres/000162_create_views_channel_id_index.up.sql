-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_channel_id ON Views(ChannelId);
