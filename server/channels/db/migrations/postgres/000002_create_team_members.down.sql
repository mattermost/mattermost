-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_teammembers_team_id ON teammembers (teamid);

ALTER TABLE teammembers DROP COLUMN IF EXISTS schemeuser;
ALTER TABLE teammembers DROP COLUMN IF EXISTS schemeadmin;
ALTER TABLE teammembers DROP COLUMN IF EXISTS schemeguest;
ALTER TABLE teammembers DROP COLUMN IF EXISTS deleteat;

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_teammembers_user_id;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_teammembers_delete_at;

DROP TABLE IF EXISTS teammembers;
