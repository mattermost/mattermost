-- Drop users covering index
DROP INDEX IF EXISTS idx_users_id_locale;

-- Drop channels autotranslation index
DROP INDEX IF EXISTS idx_channels_autotranslation_enabled;

-- Drop channelmembers autotranslation index
DROP INDEX IF EXISTS idx_channelmembers_autotranslation_enabled;

-- Drop autotranslation columns
ALTER TABLE channelmembers
    DROP COLUMN IF EXISTS autotranslation;

ALTER TABLE channels
    DROP COLUMN IF EXISTS autotranslation;

-- Drop translations table indexes
DROP INDEX IF EXISTS idx_translations_updateat;

-- Drop translations table
DROP TABLE IF EXISTS translations;