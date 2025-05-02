-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sidebarchannels_categoryid ON sidebarchannels(categoryid);
