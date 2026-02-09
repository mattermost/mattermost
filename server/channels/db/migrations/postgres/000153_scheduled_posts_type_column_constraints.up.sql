UPDATE scheduledposts SET type = '' WHERE type IS NULL;

ALTER TABLE scheduledposts
	ALTER COLUMN type SET DEFAULT '',
	ALTER COLUMN type SET NOT NULL;
