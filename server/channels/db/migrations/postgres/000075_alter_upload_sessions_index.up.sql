DO $$
<<alter_index>>
DECLARE
    column_name text;
BEGIN
    select array_to_string(array_agg(a.attname), ', ') as column_name INTO column_name
    from
        pg_index ix,
        pg_attribute a
    where
        ix.indexrelid='idx_uploadsessions_user_id'::regclass
        and a.attrelid = ix.indrelid
        and a.attnum = ANY(ix.indkey);

    IF COALESCE (column_name, '') = text('type') THEN
        DROP INDEX IF EXISTS idx_uploadsessions_user_id;
        CREATE INDEX IF NOT EXISTS idx_uploadsessions_user_id on uploadsessions(userid);
    END IF;
END alter_index $$;