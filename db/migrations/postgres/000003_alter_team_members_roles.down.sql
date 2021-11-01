DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    col_exist_and_type_different boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist_and_type_different
    FROM information_schema.columns
    WHERE table_name = 'teammembers'
    AND column_name = 'roles'
    AND data_type = 'character varying'
    AND NOT character_maximum_length = 64;

    IF col_exist_and_type_different THEN
        ALTER TABLE teammembers ALTER COLUMN roles TYPE varchar(64);
    END IF;
END modify_column_type_if_type_is_different $$
