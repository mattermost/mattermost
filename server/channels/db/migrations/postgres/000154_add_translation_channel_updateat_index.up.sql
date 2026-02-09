-- morph:nontransactional
DROP INDEX CONCURRENTLY IF EXISTS idx_translations_updateat;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translations_channel_updateat
    ON translations(channelid, objectType, updateAt DESC, dstlang);
