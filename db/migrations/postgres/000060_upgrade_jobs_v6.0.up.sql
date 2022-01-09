ALTER TABLE jobs ALTER COLUMN data TYPE jsonb USING data::jsonb;
