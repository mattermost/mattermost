DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'pluginkeyvaluestore'
    AND column_name = 'pkey'
    AND NOT data_type = 'varchar(50)';
IF column_exist THEN
    ALTER TABLE pluginkeyvaluestore ALTER COLUMN pkey TYPE varchar(50);
END IF;
END $$;
