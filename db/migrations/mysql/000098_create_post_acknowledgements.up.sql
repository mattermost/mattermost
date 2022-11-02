CREATE TABLE IF NOT EXISTS PostAcknowledgements (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    Completed tinyint(1) DEFAULT '0',
    CreateAt bigint(20) DEFAULT NULL,
    AcknowledgedAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (PostId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
