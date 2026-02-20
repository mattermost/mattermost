-- morph:nontransactional
DROP INDEX CONCURRENTLY IF EXISTS idx_views_creator_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_views_channel_id_delete_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_views_channel_id;
DROP TABLE IF EXISTS Views;
