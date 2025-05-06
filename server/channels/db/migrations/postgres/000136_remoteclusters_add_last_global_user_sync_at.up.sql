DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'remoteclusters'
        AND column_name = 'lastglobalusersync_at'
    ) THEN
        ALTER TABLE remoteclusters ADD COLUMN lastglobalusersync_at bigint DEFAULT 0;
    END IF;
END $$;