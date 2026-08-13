-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_channel_id_delete_at ON Views(ChannelId, DeleteAt);
