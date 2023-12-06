CREATE TABLE IF NOT EXISTS Configurations (
    Id VARCHAR(26) PRIMARY KEY,
    Value TEXT NOT NULL,
    CreateAt BIGINT NOT NULL,
    Active BOOLEAN NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Configurations'
        AND table_schema = DATABASE()
        AND column_name = 'Value'
        AND NOT data_type = 'MEDIUMTEXT'
    ) > 0,
    'ALTER TABLE Configurations MODIFY Value MEDIUMTEXT;',
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
        AND TABLE_NAME = 'Configurations'
        AND C.CHARACTER_SET_NAME != 'utf8mb4'
    ) > 0,
    'ALTER TABLE Configurations CONVERT TO CHARACTER SET utf8mb4;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;


