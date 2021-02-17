ALTER TABLE teammembers
DROP COLUMN IF EXISTS schemeuser;
DROP COLUMN IF EXISTS schemeadmin;
DROP COLUMN IF EXISTS schemeguest;

DROP INDEX IF EXISTS idx_teammembers_team_id;
DROP INDEX IF EXISTS idx_teammembers_user_id;
DROP INDEX IF EXISTS idx_teammembers_delete_at;

DROP TABLE IF EXISTS TeamMembers;
