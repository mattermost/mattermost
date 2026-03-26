ALTER TABLE scheduledposts ADD COLUMN IF NOT EXISTS repeattype VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE scheduledposts ADD COLUMN IF NOT EXISTS repeattimezone VARCHAR(128) NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_scheduledposts_repeat_timezone_required') THEN
        ALTER TABLE scheduledposts
            ADD CONSTRAINT chk_scheduledposts_repeat_timezone_required
            CHECK (repeattype = '' OR repeattimezone <> '');
    END IF;
END $$;
