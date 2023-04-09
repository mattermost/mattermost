DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'pluginkeyvaluestore'
    AND table_schema = current_schema()
    AND column_name = 'pkey'
    AND NOT data_type = 'varchar(150)';
IF column_exist THEN
    ALTER TABLE pluginkeyvaluestore ALTER COLUMN pkey TYPE varchar(150);
END IF;
END $$;
