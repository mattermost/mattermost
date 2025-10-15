-- Drop channelmembers autotranslation index
DROP INDEX IF EXISTS idx_channelmembers_autotranslation_enabled;

-- Drop channelmembers constraints and props column
ALTER TABLE channelmembers
    DROP CONSTRAINT IF EXISTS chk_channelmembers_autotranslation_bool;
ALTER TABLE channelmembers
    DROP COLUMN IF EXISTS props;

-- Drop channels constraints and props column
ALTER TABLE channels
    DROP CONSTRAINT IF EXISTS chk_channels_autotranslation_bool;
ALTER TABLE channels
    DROP COLUMN IF EXISTS props;

-- Drop translations table indexes
DROP INDEX IF EXISTS idx_translations_trgm;
DROP INDEX IF EXISTS idx_translations_fts;
DROP INDEX IF EXISTS idx_translations_updateat;

-- Drop translations table
DROP TABLE IF EXISTS translations;

-- Drop extensions added for autotranslation feature
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS unaccent;