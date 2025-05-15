DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'commands' 
        AND column_name = 'autocompleterequesturl'
    ) THEN
        ALTER TABLE commands DROP COLUMN autocompleterequesturl;
    END IF;
END $$;