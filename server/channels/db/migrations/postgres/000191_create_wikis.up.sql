CREATE TABLE IF NOT EXISTS Wikis (
    Id          VARCHAR(26) PRIMARY KEY,
    ChannelId   VARCHAR(26) NOT NULL,
    TeamId      VARCHAR(26) NOT NULL DEFAULT '',
    Title       VARCHAR(128) NOT NULL,
    Description TEXT,
    Icon        VARCHAR(256),
    CreatorId   VARCHAR(26) NOT NULL DEFAULT '',
    Props       JSONB DEFAULT '{}',
    CreateAt    BIGINT NOT NULL,
    UpdateAt    BIGINT NOT NULL,
    DeleteAt    BIGINT NOT NULL DEFAULT 0,
    SortOrder   BIGINT NOT NULL DEFAULT 0
);
