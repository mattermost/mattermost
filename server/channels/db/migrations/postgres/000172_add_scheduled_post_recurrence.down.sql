ALTER TABLE scheduledposts DROP CONSTRAINT IF EXISTS chk_scheduledposts_repeat_timezone_required;
ALTER TABLE scheduledposts DROP COLUMN IF EXISTS repeattimezone;
ALTER TABLE scheduledposts DROP COLUMN IF EXISTS repeattype;
