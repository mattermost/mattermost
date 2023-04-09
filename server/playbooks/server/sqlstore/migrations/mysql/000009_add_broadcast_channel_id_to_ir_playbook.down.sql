SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'BroadcastChannelID'
    ),
    'ALTER TABLE IR_Playbook DROP COLUMN BroadcastChannelID;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
