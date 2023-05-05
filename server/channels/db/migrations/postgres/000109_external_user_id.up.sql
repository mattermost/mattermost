ALTER TABLE users ADD COLUMN IF NOT EXISTS externaluserid varchar(255);
CREATE INDEX IF NOT EXISTS idx_users_externaluserid ON users(externaluserid);
