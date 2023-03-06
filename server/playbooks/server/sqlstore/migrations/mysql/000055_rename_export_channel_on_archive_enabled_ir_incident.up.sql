SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'ExportChannelOnArchiveEnabled'
    ),
    'ALTER TABLE IR_Incident CHANGE COLUMN ExportChannelOnArchiveEnabled ExportChannelOnFinishedEnabled BOOLEAN NOT NULL DEFAULT FALSE;',
    'SELECT 1;'
));

PREPARE renameColumnIfExists FROM @preparedStatement;
EXECUTE renameColumnIfExists;
DEALLOCATE PREPARE renameColumnIfExists;
