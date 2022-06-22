CREATE TABLE IF NOT EXISTS PostReminders (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    TargetTime bigint,
    PRIMARY KEY (PostId, UserId)
);
