DROP INDEX IF EXISTS idx_translations_channel_updateat;

-- Restore the single-column updateAt index from migration 147
CREATE INDEX IF NOT EXISTS idx_translations_updateat
    ON translations (updateAt DESC);

ALTER TABLE translations DROP COLUMN IF EXISTS channelid;
