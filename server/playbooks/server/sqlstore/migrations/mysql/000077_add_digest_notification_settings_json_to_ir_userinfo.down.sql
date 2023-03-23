SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_UserInfo'
        AND table_schema = DATABASE()
        AND column_name = 'DigestNotificationSettingsJSON'
    ),
    'ALTER TABLE IR_UserInfo DROP COLUMN DigestNotificationSettingsJSON;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
