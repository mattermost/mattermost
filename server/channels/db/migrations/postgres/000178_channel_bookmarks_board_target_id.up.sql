ALTER TYPE channel_bookmark_type ADD VALUE IF NOT EXISTS 'board';
ALTER TABLE channelbookmarks
    ADD COLUMN IF NOT EXISTS targetid varchar(26) DEFAULT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channelbookmarks_targetid
    ON channelbookmarks (targetid)
    WHERE targetid IS NOT NULL;
