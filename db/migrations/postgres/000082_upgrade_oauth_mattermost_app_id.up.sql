DO $$
DECLARE
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'oauthapps'
    AND column_name = 'mattermostappid';
IF column_exist THEN
    UPDATE OAuthApps SET MattermostAppID = '' WHERE MattermostAppID IS NULL;
    ALTER TABLE OAuthApps ALTER COLUMN MattermostAppID SET DEFAULT '';
    ALTER TABLE OAuthApps ALTER COLUMN MattermostAppID SET NOT NULL;
END IF;
END $$;
