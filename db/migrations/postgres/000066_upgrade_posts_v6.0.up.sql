DO $$
<<migrate_root_id>>
DECLARE 
    parentid_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO parentid_exist
    FROM information_schema.columns
    WHERE table_name = 'posts'
    AND column_name = 'parentid';
IF parentid_exist THEN
    UPDATE posts SET rootid = parentid WHERE rootid = '' AND rootid != parentid;
END IF;
END migrate_root_id $$;

ALTER TABLE posts ALTER COLUMN fileids TYPE varchar(300);
ALTER TABLE posts ALTER COLUMN props TYPE jsonb USING props::jsonb;
ALTER TABLE posts DROP COLUMN IF EXISTS parentid;

CREATE INDEX IF NOT EXISTS idx_posts_root_id_delete_at ON posts(rootid, deleteat);

DROP INDEX IF EXISTS idx_posts_root_id;
