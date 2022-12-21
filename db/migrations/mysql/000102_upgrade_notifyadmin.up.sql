SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'NotifyAdmin'
        AND table_schema = DATABASE()
        AND column_name = 'RequiredFeature'
    	AND column_type != 'text'
    ) > 0,
    'ALTER TABLE NotifyAdmin MODIFY COLUMN RequiredFeature text;',
    'SELECT 1;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'NotifyAdmin'
        AND table_schema = DATABASE()
        AND column_name = 'RequiredPlan'
    	AND column_type != 'varchar(100)'
    ) > 0,
    'ALTER TABLE NotifyAdmin MODIFY COLUMN RequiredPlan varchar(100);',
    'SELECT 1;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
