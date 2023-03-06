SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'WebhookOnCreationURL'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN WebhookOnCreationURL TEXT;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE IR_Incident 
SET WebhookOnCreationURL = ''
WHERE WebhookOnCreationURL IS NULL
