ALTER TABLE sidebarcategories DROP COLUMN IF EXISTS collapsed;
ALTER TABLE sidebarcategories DROP COLUMN IF EXISTS muted;

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
    AND character_maximum_length = 26;

    IF col_exists AND NOT type_exists THEN
        ALTER TABLE sidebarcategories ALTER COLUMN id TYPE varchar(26);
    END IF;
END modify_column_type_if_type_is_different $$;

DROP TABLE IF EXISTS sidebarcategories;
