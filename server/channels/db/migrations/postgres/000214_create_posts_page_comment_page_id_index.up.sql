-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_page_comment_page_id ON Posts ((Props->>'page_id')) WHERE Type = 'custom_page_comment' AND DeleteAt = 0;
