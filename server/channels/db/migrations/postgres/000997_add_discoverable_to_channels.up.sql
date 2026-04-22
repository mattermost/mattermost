ALTER TABLE channels ADD COLUMN IF NOT EXISTS discoverable boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS channeljoinrequests (
    id VARCHAR(26) PRIMARY KEY,
    channelid VARCHAR(26) NOT NULL,
    userid VARCHAR(26) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    createat BIGINT NOT NULL,
    updateat BIGINT NOT NULL,
    reviewedby VARCHAR(26) DEFAULT '',
    UNIQUE (channelid, userid, status)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channeljoinrequests_channel_status ON channeljoinrequests (channelid, status);
