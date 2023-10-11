CREATE TABLE IF NOT EXISTS Jobs (
    Id varchar(26) NOT NULL,
    Type varchar(32) DEFAULT NULL,
    Priority bigint(20) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    StartAt bigint(20) DEFAULT NULL,
    LastActivityAt bigint(20) DEFAULT NULL,
    Status varchar(32) DEFAULT NULL,
    Progress bigint(20) DEFAULT NULL,
    Data text,
    PRIMARY KEY (Id),
    KEY idx_jobs_type (Type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
