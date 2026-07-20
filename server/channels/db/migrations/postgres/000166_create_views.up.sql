CREATE TABLE IF NOT EXISTS Views (
    Id          VARCHAR(26)  PRIMARY KEY,
    ChannelId   VARCHAR(26)  NOT NULL,
    Type        VARCHAR(32)  NOT NULL,
    CreatorId   VARCHAR(26)  NOT NULL,
    Title       VARCHAR(256) NOT NULL,
    Description TEXT,
    SortOrder   INTEGER      NOT NULL DEFAULT 0,
    Props       jsonb,
    CreateAt    BIGINT       NOT NULL,
    UpdateAt    BIGINT       NOT NULL,
    DeleteAt    BIGINT       NOT NULL DEFAULT 0
);
