SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_UserInfo'
        AND table_schema = DATABASE()
        AND column_name = 'DigestNotificationSettingsJSON'
    ),
    'ALTER TABLE IR_UserInfo ADD COLUMN DigestNotificationSettingsJSON JSON;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
