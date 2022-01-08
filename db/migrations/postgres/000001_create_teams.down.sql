CREATE INDEX IF NOT EXISTS idx_teams_name ON teams (name);

ALTER TABLE teams DROP COLUMN IF EXISTS allowopeninvite;
ALTER TABLE teams DROP COLUMN IF EXISTS lastteamiconupdate;
ALTER TABLE teams DROP COLUMN IF EXISTS description;
ALTER TABLE teams DROP COLUMN IF EXISTS groupconstrained;

DROP INDEX IF EXISTS idx_teams_invite_id;
DROP INDEX IF EXISTS idx_teams_update_at;
DROP INDEX IF EXISTS idx_teams_create_at;
DROP INDEX IF EXISTS idx_teams_delete_at;
DROP INDEX IF EXISTS idx_teams_scheme_id;

DROP TABLE IF EXISTS teams;
