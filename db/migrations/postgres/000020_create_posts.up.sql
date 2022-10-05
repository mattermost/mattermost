CREATE TABLE IF NOT EXISTS posts (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    userid VARCHAR(26),
    channelid VARCHAR(26),
    rootid VARCHAR(26),
    parentid VARCHAR(26),
    originalid VARCHAR(26),
    message VARCHAR(65535),
    type VARCHAR(26),
    props VARCHAR(8000),
    hashtags VARCHAR(1000),
    filenames VARCHAR(4000)
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS fileids VARCHAR(300);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hasreactions boolean;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS editat bigint;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ispinned boolean;

CREATE INDEX IF NOT EXISTS idx_posts_update_at ON posts(updateat);
CREATE INDEX IF NOT EXISTS idx_posts_create_at ON posts(createat);
CREATE INDEX IF NOT EXISTS idx_posts_delete_at ON posts(deleteat);
CREATE INDEX IF NOT EXISTS idx_posts_root_id ON posts(rootid);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(userid);
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON posts(ispinned);
CREATE INDEX IF NOT EXISTS idx_posts_channel_id_update_at ON posts(channelid, updateat);
CREATE INDEX IF NOT EXISTS idx_posts_channel_id_delete_at_create_at ON posts(channelid, deleteat, createat);
CREATE INDEX IF NOT EXISTS idx_posts_message_txt ON posts USING gin(to_tsvector('english', message));
CREATE INDEX IF NOT EXISTS idx_posts_hashtags_txt ON posts USING gin(to_tsvector('english', hashtags));
CREATE INDEX IF NOT EXISTS idx_posts_props_broadcasted_thread_reply ON posts(props->>'broadcasted_thread_reply');

ALTER TABLE posts ADD COLUMN IF NOT EXISTS remoteid VARCHAR(26);

DROP INDEX IF EXISTS idx_posts_channel_id;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'posts'
    AND column_name = 'fileids'
    AND NOT data_type = 'varchar(300)';
IF column_exist THEN
    ALTER TABLE posts ALTER COLUMN fileids TYPE varchar(300);
END IF;
END $$;
