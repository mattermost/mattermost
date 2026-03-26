ALTER TABLE oauthapps DROP COLUMN IF EXISTS iconurl;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS istrusted;

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_oauthapps_creator_id;

DROP TABLE IF EXISTS oauthapps;
