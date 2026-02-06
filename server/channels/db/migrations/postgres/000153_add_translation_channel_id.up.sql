-- Add channel_id column
ALTER TABLE translations ADD COLUMN IF NOT EXISTS channelid varchar(26);

-- Drop the single-column updateAt index from migration 147; it causes the
-- planner to ignore the composite covering index added below. This index has no practical use.
DROP INDEX IF EXISTS idx_translations_updateat;

-- Create covering index for etag queries
-- Index is per-channel (not per-locale) since we cache etags at channel level
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translations_channel_updateat
    ON translations(channelid, objectType, updateAt DESC, dstlang);
