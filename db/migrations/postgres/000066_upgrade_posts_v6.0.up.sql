DO $$
<<migrate_root_id>>
DECLARE 
    parentid_exist boolean := false;
    alter_fileids boolean := false;
    alter_props boolean := false;
BEGIN
SELECT count(*) != 0 INTO parentid_exist
    FROM information_schema.columns
    WHERE table_name = 'posts'
    AND column_name = 'parentid';
SELECT count(*) != 0 INTO alter_fileids
    FROM information_schema.columns
    WHERE table_name = 'posts'
    AND column_name = 'fileids'
    AND data_type = 'character varying'
    AND character_maximum_length != 300;
SELECT count(*) != 0 INTO alter_props
    FROM information_schema.columns
    WHERE table_name = 'posts'
    AND column_name = 'props'
    AND data_type != 'jsonb';
IF alter_fileids OR alter_props THEN
    IF parentid_exist THEN
        UPDATE posts SET rootid = parentid WHERE rootid = '' AND rootid != parentid;
        ALTER TABLE posts ALTER COLUMN fileids TYPE varchar(300), ALTER COLUMN props TYPE jsonb USING props::jsonb, DROP COLUMN ParentId;
    ELSE
        ALTER TABLE posts ALTER COLUMN fileids TYPE varchar(300), ALTER COLUMN props TYPE jsonb USING props::jsonb;
    END IF;
END IF;
END migrate_root_id $$;

CREATE INDEX IF NOT EXISTS idx_posts_root_id_delete_at ON posts(rootid, deleteat);

DROP INDEX IF EXISTS idx_posts_root_id;
