SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Bots'
        AND table_schema = DATABASE()
        AND column_name = 'LastIconUpdate'
    ) > 0,
    'ALTER TABLE Bots DROP COLUMN LastIconUpdate;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS bots;
