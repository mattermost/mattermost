DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sharedchannelremotes'
        AND column_name = 'syncoutbound'
    ) THEN
        ALTER TABLE sharedchannelremotes DROP COLUMN syncoutbound;
    END IF;
END
$$;