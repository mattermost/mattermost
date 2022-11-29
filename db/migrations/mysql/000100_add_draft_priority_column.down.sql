SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Drafts'
        AND table_schema = DATABASE()
        AND column_name = 'Priority'
    ) > 0,
    'ALTER TABLE Drafts DROP COLUMN Priority;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Drafts'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Drafts ADD COLUMN DeleteAt bigint(20) DEFAULT 0;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
