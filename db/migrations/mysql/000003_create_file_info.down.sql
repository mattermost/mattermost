SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'Content'
    ) > 0,
    'ALTER TABLE FileInfo DROP COLUMN Content;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'MiniPreview'
    ) > 0,
    'ALTER TABLE FileInfo DROP COLUMN MiniPreview;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS FileInfo;
