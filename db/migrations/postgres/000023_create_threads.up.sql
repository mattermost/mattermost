CREATE TABLE IF NOT EXISTS threads (
    postid VARCHAR(26) PRIMARY KEY,
    channelid VARCHAR(26),
    replycount bigint,
    lastreplyat bigint,
    participants text
);

ALTER TABLE threads ADD COLUMN IF NOT EXISTS channelid VARCHAR(26);
CREATE INDEX IF NOT EXISTS idx_threads_channel_id ON threads (channelid);

UPDATE threads
    SET channelId=posts.channelid
    FROM posts
    WHERE posts.id=threads.postid
    AND threads.channelid IS NULL;

