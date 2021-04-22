DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    type_exists boolean := false;
    col_exists boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exists
    FROM information_schema.columns
    WHERE table_name = 'sidebarchannels'
    AND column_name = 'categoryid';

    SELECT count(*) != 0 INTO type_exists
    FROM information_schema.columns
    WHERE table_name = 'sidebarchannels'
    AND column_name = 'categoryid'
    AND data_type = 'character varying'
    AND character_maximum_length = 26;

    IF col_exists AND NOT type_exists THEN
        ALTER TABLE sidebarchannels ALTER COLUMN categoryid TYPE varchar(26);
    END IF;
END modify_column_type_if_type_is_different $$;

DROP TABLE IF EXISTS sidebarchannels;
