CREATE TABLE IF NOT EXISTS PostReadStatus (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    CreateAt bigint NOT NULL,
    PRIMARY KEY (PostId, UserId)
);
