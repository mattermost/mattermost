SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'Type'
        AND column_type != 'ENUM("D", "O", "G", "P")'
    ) > 0,
    'ALTER TABLE Channels MODIFY COLUMN Type ENUM("D", "O", "G", "P");',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Teams'
        AND table_schema = DATABASE()
        AND column_name = 'Type'
        AND column_type != 'ENUM("I", "O")'
    ) > 0,
    'ALTER TABLE Teams MODIFY COLUMN Type ENUM("I", "O");',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'Type'
        AND column_type != 'ENUM("attachment", "import")'
    ) > 0,
    'ALTER TABLE UploadSessions MODIFY COLUMN Type ENUM("attachment", "import");',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;