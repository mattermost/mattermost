DO $$
DECLARE
    col_len int;
BEGIN
    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'message';
    IF col_len = 1048576 THEN
        ALTER TABLE posts ALTER COLUMN message TYPE VARCHAR(65535);
    END IF;

    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'message';
    IF col_len = 1048576 THEN
        ALTER TABLE drafts ALTER COLUMN message TYPE VARCHAR(65535);
    END IF;

    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'scheduledposts' AND column_name = 'message';
    IF col_len = 1048576 THEN
        ALTER TABLE scheduledposts ALTER COLUMN message TYPE VARCHAR(65535);
    END IF;

    SELECT character_maximum_length INTO col_len
    FROM information_schema.columns
    WHERE table_name = 'temporaryposts' AND column_name = 'message';
    IF col_len = 1048576 THEN
        ALTER TABLE temporaryposts ALTER COLUMN message TYPE VARCHAR(65535);
    END IF;
END $$;
