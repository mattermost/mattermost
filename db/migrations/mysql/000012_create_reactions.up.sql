CREATE TABLE IF NOT EXISTS Reactions (
    UserId varchar(26) NOT NULL,
    PostId varchar(26) NOT NULL,
    EmojiName varchar(64) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (PostId, UserId, EmojiName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
