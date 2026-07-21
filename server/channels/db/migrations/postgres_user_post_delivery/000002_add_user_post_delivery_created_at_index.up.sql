-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_post_delivery_created_at ON UserPostDelivery USING brin (created_at);
