SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'ALTER TABLE UploadSessions DROP RemoteId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'ReqFileId'
    ) > 0,
    'ALTER TABLE UploadSessions DROP ReqFileId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS UploadSessions;
