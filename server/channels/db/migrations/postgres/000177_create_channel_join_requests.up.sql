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
