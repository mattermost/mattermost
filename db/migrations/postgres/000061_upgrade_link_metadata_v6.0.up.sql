ALTER TABLE linkmetadata ALTER COLUMN data TYPE jsonb USING data::jsonb;
