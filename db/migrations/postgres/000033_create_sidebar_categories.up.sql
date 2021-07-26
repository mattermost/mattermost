CREATE TABLE IF NOT EXISTS sidebarcategories (
    id VARCHAR(128),
    userid VARCHAR(26),
    teamid VARCHAR(26),
    sortorder bigint,
    sorting VARCHAR(64),
    type VARCHAR(64),
    displayname VARCHAR(64),
    muted boolean DEFAULT false,
    collapsed boolean DEFAULT false,
    PRIMARY KEY (id)
);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    type_exists boolean := false;
    col_exists boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exists
    FROM information_schema.columns
    WHERE table_name = 'sidebarcategories'
    AND column_name = 'id';

    SELECT count(*) != 0 INTO type_exists
    FROM information_schema.columns
    WHERE table_name = 'sidebarcategories'
    AND column_name = 'id'
    AND data_type = 'character varying'
    AND character_maximum_length = 128;

    IF col_exists AND NOT type_exists THEN
        ALTER TABLE sidebarcategories ALTER COLUMN id TYPE varchar(128);
    END IF;
END modify_column_type_if_type_is_different $$;

ALTER TABLE sidebarcategories ADD COLUMN IF NOT EXISTS muted boolean DEFAULT false;
ALTER TABLE sidebarcategories ADD COLUMN IF NOT EXISTS collapsed boolean DEFAULT false;
