DO $$
<<alter_index>>
DECLARE
    column_name text;
BEGIN
    select array_to_string(array_agg(a.attname), ', ') as column_name INTO column_name
    from
        pg_index ix,
        pg_class,
        pg_attribute a,
        pg_namespace
    where
        pg_class.oid = 'usertermsofservice'::regclass AND
        indrelid = pg_class.oid AND
        nspname = 'public' AND
        pg_class.relnamespace = pg_namespace.oid AND
        a.attrelid = pg_class.oid AND
        a.attnum = ANY(ix.indkey) AND
        indisprimary;

    IF COALESCE (column_name, '') != text('userid') THEN
        DELETE FROM usertermsofservice E USING
            (
                SELECT *, RANK() OVER(PARTITION BY userid ORDER BY createat DESC) rank FROM E
            ) T
            WHERE T.rank > 1 AND T.userid = E.userid AND E.termsofserviceid = T.termsofserviceid;
        ALTER TABLE usertermsofservice
            DROP CONSTRAINT IF EXISTS usertermsofservice_pkey,
            ADD PRIMARY KEY (userid);
    END IF;
END alter_index $$;
