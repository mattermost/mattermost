CREATE TABLE IF NOT EXISTS PostAcknowledgements (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    AcknowledgedAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (PostId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
