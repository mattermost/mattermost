-- Add channel_id column
ALTER TABLE translations ADD COLUMN IF NOT EXISTS channelid varchar(26);

-- Create covering index for etag queries
-- Index is per-channel (not per-locale) since we cache etags at channel level
CREATE INDEX IF NOT EXISTS idx_translations_channel_updateat
    ON translations(channelid, objectType, updateAt DESC)
    WHERE channelid IS NOT NULL;
