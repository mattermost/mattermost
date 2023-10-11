CREATE TABLE IF NOT EXISTS Compliances (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20),
    UserId varchar(26) DEFAULT NULL,
    Status varchar(64) DEFAULT NULL,
    Count integer DEFAULT NULL,
    `Desc` text,
    Type varchar(64) DEFAULT NULL,
    StartAt bigint(20),
    EndAt bigint(20),
    Keywords text,
    Emails text,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
