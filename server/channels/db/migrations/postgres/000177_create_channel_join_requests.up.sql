CREATE TABLE IF NOT EXISTS ChannelJoinRequests (
    Id           VARCHAR(26)  PRIMARY KEY,
    ChannelId    VARCHAR(26)  NOT NULL,
    UserId       VARCHAR(26)  NOT NULL,
    Message      TEXT         NOT NULL DEFAULT '',
    Status       VARCHAR(16)  NOT NULL DEFAULT 'pending',
    DenialReason TEXT         NOT NULL DEFAULT '',
    CreateAt     BIGINT       NOT NULL,
    UpdateAt     BIGINT       NOT NULL,
    ReviewedBy   VARCHAR(26)  NOT NULL DEFAULT '',
    ReviewedAt   BIGINT       NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channeljoinrequests_pending_unique
    ON ChannelJoinRequests (ChannelId, UserId)
    WHERE Status = 'pending';

CREATE INDEX IF NOT EXISTS idx_channeljoinrequests_channel_status_createat
    ON ChannelJoinRequests (ChannelId, Status, CreateAt DESC);

CREATE INDEX IF NOT EXISTS idx_channeljoinrequests_user_status_createat
    ON ChannelJoinRequests (UserId, Status, CreateAt DESC);
