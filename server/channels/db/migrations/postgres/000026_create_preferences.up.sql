CREATE TABLE IF NOT EXISTS preferences (
    userid varchar(26) NOT NULL,
    category varchar(32) NOT NULL,
    name varchar(32) NOT NULL,
    value varchar(2000),
    PRIMARY KEY (userid, category, name)
);

CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(category);
CREATE INDEX IF NOT EXISTS idx_preferences_name ON preferences(name);

DO $$
<<modify_column_type_if_type_is_different>>
DECLARE
    type_exists boolean := false;
    col_exists boolean := false;
BEGIN
    SELECT count(*) != 0 INTO col_exists
    FROM information_schema.columns
    WHERE table_name = 'preferences'
    AND table_schema = current_schema()
    AND column_name = 'value';

    SELECT count(*) != 0 INTO type_exists
    FROM information_schema.columns
    WHERE table_name = 'preferences'
    AND table_schema = current_schema()
    AND column_name = 'value'
    AND data_type = 'character varying'
    AND character_maximum_length = 2000;

    IF col_exists AND NOT type_exists THEN
        ALTER TABLE preferences ALTER COLUMN value TYPE varchar(2000);
    END IF;
END modify_column_type_if_type_is_different $$;

DO $$
<<rename_solarized_theme>>
DECLARE
    preference record;
BEGIN
    FOR preference IN
        SELECT * FROM preferences WHERE category = 'theme' AND value LIKE '%solarized_%'
    LOOP
        UPDATE preferences
            SET value = replace(preference.value, 'solarized_', 'solarized-')
        WHERE userid = preference.userid
        AND category = preference.category
        AND name = preference.name;
    END LOOP;
END rename_solarized_theme $$;

DROP INDEX IF EXISTS idx_preferences_user_id;
