-- While upgrading from 5.x to 6.x with manual queries, there is a chance that this
-- migration is skipped. In that case, we need to make sure that the column is dropped.

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'ParentId'
    ) > 0,
    'ALTER TABLE Posts DROP COLUMN ParentId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
