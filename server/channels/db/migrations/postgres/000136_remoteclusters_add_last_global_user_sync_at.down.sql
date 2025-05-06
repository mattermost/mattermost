DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'remoteclusters'
        AND column_name = 'lastglobalusersync_at'
    ) THEN
        ALTER TABLE remoteclusters DROP COLUMN lastglobalusersync_at;
    END IF;
END $$;