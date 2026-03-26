-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_posts_original_id ON Posts(originalid);
