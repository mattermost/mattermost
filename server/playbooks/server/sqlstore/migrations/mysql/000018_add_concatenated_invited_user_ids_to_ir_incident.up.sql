SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'ConcatenatedInvitedUserIDs'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN ConcatenatedInvitedUserIDs TEXT;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE IR_Incident 
SET ConcatenatedInvitedUserIDs = ''
WHERE ConcatenatedInvitedUserIDs IS NULL
