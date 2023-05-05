DROP INDEX IF EXISTS idx_users_externaluserid;
ALTER TABLE fileinfo DROP COLUMN IF EXISTS externaluserid;
