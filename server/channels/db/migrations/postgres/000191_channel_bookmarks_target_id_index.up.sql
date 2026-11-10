-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channelbookmarks_type_targetid
    ON channelbookmarks (type, targetid)
    WHERE targetid IS NOT NULL;
