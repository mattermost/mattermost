CREATE TABLE IF NOT EXISTS oauthauthdata (
    clientid varchar(26),
    userid varchar(26),
    code varchar(128) NOT NULL,
    expiresin integer,
    createat bigint,
    redirecturi varchar(256),
    state varchar(1024),
    scope varchar(128),
    PRIMARY KEY (code)
);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    type_exists boolean := false;
    col_exists boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exists
    FROM information_schema.columns
    WHERE table_name = 'oauthauthdata'
    AND table_schema = current_schema()
    AND column_name = 'state';

    SELECT count(*) != 0 INTO type_exists
    FROM information_schema.columns
    WHERE table_name = 'oauthauthdata'
    AND table_schema = current_schema()
    AND column_name = 'state'
    AND data_type = 'character varying'
    AND character_maximum_length = 1024;

    IF col_exists AND NOT type_exists THEN
        ALTER TABLE oauthauthdata ALTER COLUMN state TYPE varchar(1024);
    END IF;
END modify_column_type_if_type_is_different $$;

DROP INDEX IF EXISTS idx_oauthauthdata_client_id;
