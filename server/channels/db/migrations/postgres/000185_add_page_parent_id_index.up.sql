-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_page_parent_id ON Posts(PageParentId) WHERE PageParentId != '' AND DeleteAt = 0 AND Type = 'page';
