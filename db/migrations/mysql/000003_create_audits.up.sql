CREATE TABLE IF NOT EXISTS audits (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    Action text,
    ExtraInfo text,
    IpAddress varchar(64) DEFAULT NULL,
    SessionId varchar(26) DEFAULT NULL,
    PRIMARY KEY (Id),
    KEY idx_audits_user_id (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
