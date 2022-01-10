CREATE TABLE IF NOT EXISTS TermsOfService (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    Text text,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
