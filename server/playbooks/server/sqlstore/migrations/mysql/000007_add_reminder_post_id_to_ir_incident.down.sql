SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'ReminderPostID'
    ),
    'ALTER TABLE IR_Incident DROP COLUMN ReminderPostID;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
