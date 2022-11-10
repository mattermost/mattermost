CREATE TABLE IF NOT EXISTS tokens (
    token VARCHAR(64) PRIMARY KEY,
    createat bigint,
    type VARCHAR(64),
    extra VARCHAR(2048)
);

ALTER TABLE tokens ALTER COLUMN extra TYPE VARCHAR(2048);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    type_exists boolean := false;
    col_exists boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exists
    FROM information_schema.columns
    WHERE table_name = 'tokens'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'extra';

    SELECT count(*) != 0 INTO type_exists
    FROM information_schema.columns
    WHERE table_name = 'tokens'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'extra'
    AND data_type = 'character varying'
    AND character_maximum_length = 2048;

    IF col_exists AND NOT type_exists THEN
        ALTER TABLE tokens ALTER COLUMN extra TYPE VARCHAR(2048);
    END IF;
END modify_column_type_if_type_is_different $$;
