-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_channel_id_type_deleteat ON Posts(ChannelId, Type, DeleteAt) WHERE Type='page' AND DeleteAt=0;
