CREATE TABLE IF NOT EXISTS sidebarcategories (
    id VARCHAR(26),
    userid VARCHAR(26),
    teamid VARCHAR(26),
    sortorder bigint,
    sorting VARCHAR(64),
    type VARCHAR(64),
    displayname VARCHAR(64),
    PRIMARY KEY (id)
);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'sidebarcategories'
    AND table_schema = current_schema()
    AND column_name = 'id'
    AND data_type = 'character varying'
    AND NOT character_maximum_length = 128;

    IF col_exist_and_type_different THEN
        ALTER TABLE sidebarcategories ALTER COLUMN id TYPE varchar(128);
    END IF;
END modify_column_type_if_type_is_different $$;

ALTER TABLE sidebarcategories ADD COLUMN IF NOT EXISTS muted boolean;
ALTER TABLE sidebarcategories ADD COLUMN IF NOT EXISTS collapsed boolean;
