SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'ALTER TABLE Users DROP RemoteId;',
    'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'ReqFileId'
    ) > 0,
    'ALTER TABLE Users DROP ReqFileId;',
    'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

DROP TABLE IF EXISTS UploadSessions;
