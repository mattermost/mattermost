DO $$
DECLARE
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND table_schema = current_schema()
    AND column_name = 'remoteid'
    AND NOT data_type = 'varchar(255)';
IF column_exist THEN
    ALTER TABLE users ALTER COLUMN remoteid TYPE VARCHAR(255);
END IF;
END $$;
