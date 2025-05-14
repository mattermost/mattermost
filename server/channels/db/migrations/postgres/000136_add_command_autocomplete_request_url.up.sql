DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'commands' 
        AND column_name = 'autocompleterequesturl'
    ) THEN
        ALTER TABLE commands ADD COLUMN autocompleterequesturl VARCHAR(1024) NOT NULL DEFAULT '';
    END IF;
END $$;