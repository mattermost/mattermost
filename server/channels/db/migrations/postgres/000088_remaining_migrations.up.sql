DROP TABLE IF EXISTS jobstatuses;

DROP TABLE IF EXISTS passwordrecovery;

DO $$
<<migrate_theme>>
DECLARE
    col_exist boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exist
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND table_schema = current_schema()
    AND column_name = 'themeprops';

    IF col_exist THEN
		INSERT INTO
			preferences(userid, category, name, value)
		SELECT
			id, '', '', themeprops
		FROM
			users
		WHERE
			users.themeprops != 'null';

        ALTER TABLE users DROP COLUMN themeprops;
    END IF;
END migrate_theme $$;
