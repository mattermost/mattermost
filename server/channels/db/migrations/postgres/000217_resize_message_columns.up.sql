DO $$
DECLARE
    col_len int;
BEGIN
    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'message';
    IF col_len IS NOT NULL AND col_len < 1048576 THEN
        -- Postgres rebuilds expression indexes on an altered column while holding
        -- an ACCESS EXCLUSIVE lock on posts. Drop it here so the ALTER below is
        -- metadata-only, and let 000233 recreate it with CREATE INDEX CONCURRENTLY.
        -- concurrentIndex:ignore DROP INDEX CONCURRENTLY would not reduce blocking
        -- because the ALTER below takes an ACCESS EXCLUSIVE lock regardless.
        DROP INDEX IF EXISTS idx_posts_message_txt;
        ALTER TABLE posts ALTER COLUMN message TYPE VARCHAR(1048576);
    END IF;

    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'message';
    IF col_len IS NOT NULL AND col_len < 1048576 THEN
        ALTER TABLE drafts ALTER COLUMN message TYPE VARCHAR(1048576);
    END IF;

    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'scheduledposts' AND column_name = 'message';
    IF col_len IS NOT NULL AND col_len < 1048576 THEN
        ALTER TABLE scheduledposts ALTER COLUMN message TYPE VARCHAR(1048576);
    END IF;

    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'temporaryposts' AND column_name = 'message';
    IF col_len IS NOT NULL AND col_len < 1048576 THEN
        ALTER TABLE temporaryposts ALTER COLUMN message TYPE VARCHAR(1048576);
    END IF;
END $$;
