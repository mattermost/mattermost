ALTER TABLE scheduledposts ADD COLUMN IF NOT EXISTS repeattype VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE scheduledposts ADD COLUMN IF NOT EXISTS repeattimezone VARCHAR(128) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_scheduledposts_pending_scheduled_at_id
    ON scheduledposts (scheduledat DESC, id)
    WHERE errorcode = '';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_scheduledposts_repeat_timezone_required') THEN
        ALTER TABLE scheduledposts
            ADD CONSTRAINT chk_scheduledposts_repeat_timezone_required
            CHECK (repeattype = '' OR repeattimezone <> '') NOT VALID;
    END IF;
END $$;

ALTER TABLE scheduledposts VALIDATE CONSTRAINT chk_scheduledposts_repeat_timezone_required;
