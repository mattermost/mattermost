CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_lower_message_bigm ON posts USING gin (LOWER(message) gin_bigm_ops);
