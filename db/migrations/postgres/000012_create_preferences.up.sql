CREATE TABLE IF NOT EXISTS preferences (
    userid varchar(26) NOT NULL,
    category varchar(32) NOT NULL,
    name varchar(32) NOT NULL,
    value varchar(2000),
    PRIMARY KEY (userid, category, name)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(userid);
CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(category);
CREATE INDEX IF NOT EXISTS idx_preferences_name ON preferences(name);

ALTER TABLE preferences ALTER COLUMN value TYPE varchar(2000);

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
