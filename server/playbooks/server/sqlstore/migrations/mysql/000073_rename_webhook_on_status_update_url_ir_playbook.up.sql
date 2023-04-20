SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'WebhookOnStatusUpdateURL'
    ),
    'ALTER TABLE IR_Playbook CHANGE COLUMN WebhookOnStatusUpdateURL ConcatenatedWebhookOnStatusUpdateURLs TEXT;',
    'SELECT 1;'
));

PREPARE renameColumnIfExists FROM @preparedStatement;
EXECUTE renameColumnIfExists;
DEALLOCATE PREPARE renameColumnIfExists;
