CREATE INDEX IF NOT EXISTS idx_posts_root_id ON posts(rootid);

DROP INDEX IF EXISTS idx_posts_root_id_delete_at;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS parentid varchar(26);
ALTER TABLE posts ALTER COLUMN props TYPE varchar(8000);
ALTER TABLE posts ALTER COLUMN fileids TYPE varchar(300);
