CREATE TABLE IF NOT EXISTS postspriority (
    postid VARCHAR(26) PRIMARY KEY,
    channelid VARCHAR(26) NOT NULL,
    priority VARCHAR(32) NOT NULL,
    requestedack boolean,
    persistentnotifications boolean
);

ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS urgentmentioncount bigint DEFAULT '0'::bigint;
