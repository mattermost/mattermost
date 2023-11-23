CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON posts (channelid);

DROP TABLE IF EXISTS posts;
