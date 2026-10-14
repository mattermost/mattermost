DO $$
BEGIN
    -- concurrentIndex:ignore the ALTER below takes an ACCESS EXCLUSIVE lock regardless
    DROP INDEX IF EXISTS idx_foo_bar;
    ALTER TABLE foo ALTER COLUMN bar TYPE VARCHAR(1024);
END $$;
