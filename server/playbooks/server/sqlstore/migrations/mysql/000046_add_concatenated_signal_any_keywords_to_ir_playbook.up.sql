SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'ConcatenatedSignalAnyKeywords'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN ConcatenatedSignalAnyKeywords TEXT;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE IR_Playbook 
SET ConcatenatedSignalAnyKeywords = ''
WHERE ConcatenatedSignalAnyKeywords IS NULL
