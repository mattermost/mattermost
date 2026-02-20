-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_creator_id ON Views(CreatorId);
