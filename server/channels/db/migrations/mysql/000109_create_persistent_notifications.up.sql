CREATE TABLE IF NOT EXISTS PersistentNotifications (
    PostId varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    LastSentAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    SentCount smallint DEFAULT NULL,
    PRIMARY KEY (PostId)
);
