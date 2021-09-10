ALTER TABLE oauthapps DROP COLUMN IF EXISTS iconurl;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS istrusted;

DROP INDEX IF EXISTS idx_oauthapps_creator_id ON oauthapps;

DROP TABLE IF EXISTS oauthapps;
