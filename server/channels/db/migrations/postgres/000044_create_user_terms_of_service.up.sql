-- This migration depends on users table
CREATE TABLE IF NOT EXISTS usertermsofservice (
    userid VARCHAR(26) PRIMARY KEY,
    termsofserviceid VARCHAR(26),
    createat bigint
);

DO $$
<<do_migrate_to_usertermsofservice_table>>
DECLARE
    col_exist boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'acceptedtermsofserviceid';

    IF col_exist THEN
    INSERT INTO usertermsofservice
        SELECT id, acceptedtermsofserviceid as termsofserviceid, (extract(epoch from now()) * 1000)
        FROM users
        WHERE acceptedtermsofserviceid != ''
        AND acceptedtermsofserviceid IS NOT NULL;
    END IF;
END do_migrate_to_usertermsofservice_table $$;

DROP INDEX IF EXISTS idx_user_terms_of_service_user_id;
