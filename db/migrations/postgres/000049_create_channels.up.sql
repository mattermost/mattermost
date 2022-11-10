CREATE TABLE IF NOT EXISTS channels (
    id varchar(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    teamid varchar(26),
    type varchar(1),
    displayname varchar(64),
    name varchar(64),
    header varchar(1024),
    purpose varchar(128),
    lastpostat bigint,
    totalmsgcount bigint,
    extraupdateat bigint,
    creatorid varchar(26),
    UNIQUE(name, teamid)
);

CREATE INDEX IF NOT EXISTS idx_channels_displayname ON channels (displayname);
CREATE INDEX IF NOT EXISTS idx_channels_txt ON channels (name, displayname);
CREATE INDEX IF NOT EXISTS idx_channels_displayname_lower ON channels (lower(displayname));
CREATE INDEX IF NOT EXISTS idx_channels_name_lower ON channels (lower(name));
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels (name);
CREATE INDEX IF NOT EXISTS idx_channels_update_at ON channels (updateat);
CREATE INDEX IF NOT EXISTS idx_channels_team_id ON channels (teamid);
CREATE INDEX IF NOT EXISTS idx_channels_delete_at ON channels (deleteat);
CREATE INDEX IF NOT EXISTS idx_channels_create_at ON channels (createat);
CREATE INDEX IF NOT EXISTS idx_channel_search_txt ON channels using gin (to_tsvector('english'::regconfig, (((((name)::text || ' '::text) || (displayname)::text) || ' '::text) || (purpose)::text)));

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'channels'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'purpose'
    AND data_type = 'character varying'
    AND NOT character_maximum_length = 250;

    IF col_exist_and_type_different THEN
        ALTER TABLE channels ALTER COLUMN purpose TYPE varchar(250);
    END IF;
END modify_column_type_if_type_is_different $$;

DROP INDEX IF EXISTS idx_channels_displayname;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS schemeid varchar(26);

DROP INDEX IF EXISTS idx_channels_txt;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS groupconstrained boolean;

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'channels'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'groupconstrained'
    AND NOT data_type = 'boolean';

    IF col_exist_and_type_different THEN
        ALTER TABLE channels ALTER COLUMN groupconstrained TYPE boolean;
    END IF;
END modify_column_type_if_type_is_different $$;

CREATE INDEX IF NOT EXISTS idx_channels_scheme_id ON channels (schemeid);

ALTER TABLE channels ADD COLUMN IF NOT EXISTS shared boolean;

DROP INDEX IF EXISTS idx_channels_name;

