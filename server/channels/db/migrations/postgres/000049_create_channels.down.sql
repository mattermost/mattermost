CREATE INDEX IF NOT EXISTS idx_channels_name ON channels (name);

ALTER TABLE channels DROP COLUMN IF EXISTS shared;

DROP INDEX IF EXISTS idx_channels_scheme_id;

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'channels'
    AND table_schema = current_schema()
    AND column_name = 'groupconstrained'
    AND NOT data_type = 'boolean';

    IF col_exist_and_type_different THEN
        ALTER TABLE channels ALTER COLUMN groupconstrained TYPE boolean;
    END IF;
END modify_column_type_if_type_is_different $$;

ALTER TABLE channels DROP COLUMN IF EXISTS groupconstrained;

CREATE INDEX IF NOT EXISTS idx_channels_txt ON channels (name,displayname);

ALTER TABLE channels DROP COLUMN IF EXISTS schemeid;

CREATE INDEX IF NOT EXISTS idx_channels_displayname ON channels (displayname);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'channels'
    AND table_schema = current_schema()
    AND column_name = 'purpose'
    AND data_type = 'character varying'
    AND NOT character_maximum_length = 64;

    IF col_exist_and_type_different THEN
        ALTER TABLE channels ALTER COLUMN purpose TYPE varchar(64);
    END IF;
END modify_column_type_if_type_is_different $$;

DROP INDEX IF EXISTS idx_channels_displayname;
DROP INDEX IF EXISTS idx_channels_txt;
DROP INDEX IF EXISTS idx_channels_displayname_lower;
DROP INDEX IF EXISTS idx_channels_name_lower;
DROP INDEX IF EXISTS idx_channels_name;
DROP INDEX IF EXISTS idx_channels_update_at;
DROP INDEX IF EXISTS idx_channels_team_id;
DROP INDEX IF EXISTS idx_channels_delete_at;
DROP INDEX IF EXISTS idx_channels_create_at;
DROP INDEX IF EXISTS idx_channel_search_txt;

DROP TABLE IF EXISTS channels;
