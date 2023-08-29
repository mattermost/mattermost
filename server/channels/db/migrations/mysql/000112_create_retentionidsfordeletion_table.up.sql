CREATE TABLE IF NOT EXISTS RetentionIdsForDeletion (
    Id varchar(26) NOT NULL,
    TableName varchar(64),
    Ids json,
    PRIMARY KEY (Id),
    KEY idx_retentionidsfordeletion_tablename (TableName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
