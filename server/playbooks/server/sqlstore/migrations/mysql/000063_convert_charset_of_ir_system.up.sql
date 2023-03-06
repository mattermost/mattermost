SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_System'
        AND table_schema = DATABASE()
    ),
    'ALTER TABLE IR_System CONVERT TO CHARACTER SET utf8mb4;',
    'SELECT 1;'
));

PREPARE changeTableCharacterSetIfExists FROM @preparedStatement;
EXECUTE changeTableCharacterSetIfExists;
DEALLOCATE PREPARE changeTableCharacterSetIfExists;
