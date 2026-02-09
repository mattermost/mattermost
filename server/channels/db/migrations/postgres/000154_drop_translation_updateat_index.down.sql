-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translations_updateat
    ON translations (updateAt DESC);
