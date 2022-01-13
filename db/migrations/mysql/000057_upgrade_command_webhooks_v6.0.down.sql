
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'CommandWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'ParentId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE CommandWebhooks ADD COLUMN ParentId varchar(26) DEFAULT NULL;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;