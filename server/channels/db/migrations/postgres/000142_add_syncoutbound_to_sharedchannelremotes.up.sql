DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sharedchannelremotes'
        AND column_name = 'syncoutbound'
    ) THEN
        ALTER TABLE sharedchannelremotes ADD COLUMN syncoutbound boolean DEFAULT TRUE;
    END IF;
END
$$;