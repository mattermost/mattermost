CREATE TABLE IF NOT EXISTS Licenses (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    Bytes text,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
