ALTER TABLE postspriority ADD COLUMN IF NOT EXISTS interval integer;

ALTER TABLE persistentnotifications ADD COLUMN IF NOT EXISTS interval integer;
