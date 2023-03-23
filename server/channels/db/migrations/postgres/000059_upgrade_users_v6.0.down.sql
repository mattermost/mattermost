ALTER TABLE users ALTER COLUMN timezone TYPE varchar(256);
ALTER TABLE users ALTER COLUMN timezone SET DEFAULT '{"automaticTimezone":"","manualTimezone":"","useAutomaticTimezone":"true"}'::character varying;
ALTER TABLE users ALTER COLUMN notifyprops TYPE varchar(2000);
ALTER TABLE users ALTER COLUMN props TYPE varchar(4000);
