CREATE INDEX IF NOT EXISTS idx_posts_lower_message_bigm ON posts USING gin (LOWER(message) gin_bigm_ops);
--CONCURRENTLY cannot be used because morph runs migrations inside a transaction, which causes failure.
