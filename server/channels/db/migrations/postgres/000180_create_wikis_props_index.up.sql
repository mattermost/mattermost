-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wikis_props ON Wikis USING GIN (Props);
