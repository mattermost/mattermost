CREATE TABLE IF NOT EXISTS BotEvents (
    Id        varchar(26) NOT NULL,
    BotUserId varchar(26) NOT NULL,
    Type      varchar(32) NOT NULL,
    CreateAt  bigint      NOT NULL,
    Payload   jsonb       NOT NULL,
    PRIMARY KEY (BotUserId, CreateAt, Id)
);
