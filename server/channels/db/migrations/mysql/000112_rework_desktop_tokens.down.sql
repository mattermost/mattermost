SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'DesktopTokens'
        AND table_schema = DATABASE()
        AND index_name = 'idx_desktoptokens_createat'
    ) > 0,
    'DROP INDEX idx_desktoptokens_createat ON DesktopTokens;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS DesktopTokens;