-- CONCURRENTLY cannot be used because morph runs migrations inside a transaction, which causes failure.
CREATE INDEX IF NOT EXISTS idx_posts_message_lower ON posts USING gin (LOWER(message) gin_bigm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_hashtags_lower ON posts USING gin (LOWER(hashtags) gin_bigm_ops);
