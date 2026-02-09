-- morph:nontransactional
DROP INDEX CONCURRENTLY IF EXISTS idx_translations_channel_updateat;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translations_updateat
    ON translations (updateAt DESC);
