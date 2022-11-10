DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'sidebarchannels'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'categoryid'
    AND data_type = 'character varying'
    AND NOT character_maximum_length = 26;

    IF col_exist_and_type_different THEN
        ALTER TABLE sidebarchannels ALTER COLUMN categoryid TYPE varchar(26);
    END IF;
END modify_column_type_if_type_is_different $$;

DROP TABLE IF EXISTS sidebarchannels;
