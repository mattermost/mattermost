CREATE TABLE IF NOT EXISTS Tokens (
    Token varchar(64) NOT NULL,
    CreateAt bigint(20),
    Type varchar(64) DEFAULT NULL,
    Extra text,
    PRIMARY KEY (Token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Tokens'
        AND table_schema = DATABASE()
        AND column_name = 'Extra'
        AND data_type != 'text'
    ) > 0,
    'ALTER TABLE Tokens MODIFY Extra text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
