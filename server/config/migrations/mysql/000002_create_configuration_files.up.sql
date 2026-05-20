CREATE TABLE IF NOT EXISTS ConfigurationFiles (
    Name VARCHAR(64) PRIMARY KEY,
    Data TEXT NOT NULL,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ConfigurationFiles'
        AND table_schema = DATABASE()
        AND column_name = 'Data'
        AND NOT data_type = 'MEDIUMTEXT'
    ) > 0,
    'ALTER TABLE ConfigurationFiles MODIFY Data MEDIUMTEXT;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES AS T
        JOIN INFORMATION_SCHEMA.COLUMNS AS C USING (TABLE_SCHEMA, TABLE_NAME)
        JOIN INFORMATION_SCHEMA.COLLATION_CHARACTER_SET_APPLICABILITY AS CCSA ON (T.TABLE_COLLATION = CCSA.COLLATION_NAME)
        WHERE TABLE_SCHEMA = DATABASE()
        AND C.DATA_TYPE IN ('enum', 'varchar', 'char', 'text', 'mediumtext', 'longtext')
        AND TABLE_NAME = 'ConfigurationFiles'
        AND C.CHARACTER_SET_NAME != 'utf8mb4'
    ) > 0,
    'ALTER TABLE ConfigurationFiles CONVERT TO CHARACTER SET utf8mb4;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
