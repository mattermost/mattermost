CREATE TABLE IF NOT EXISTS ProductNoticeViewState (
    UserId VARCHAR(26) NOT NULL,
    NoticeId VARCHAR(26) NOT NULL,
    Viewed int(11),
    Timestamp bigint(20) DEFAULT NULL,
    PRIMARY KEY (UserId, NoticeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ProductNoticeViewState'
        AND table_schema = DATABASE()
        AND index_name = 'idx_notice_views_timestamp'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_notice_views_timestamp ON ProductNoticeViewState (Timestamp);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ProductNoticeViewState'
        AND table_schema = DATABASE()
        AND index_name = 'idx_notice_views_notice_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_notice_views_notice_id ON ProductNoticeViewState (NoticeId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ProductNoticeViewState'
        AND table_schema = DATABASE()
        AND index_name = 'idx_notice_views_user_id'
    ) > 0,
    'DROP INDEX idx_notice_views_user_id ON ProductNoticeViewState;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ProductNoticeViewState'
        AND table_schema = DATABASE()
        AND index_name = 'idx_notice_views_user_notice'
    ) > 0,
    'DROP INDEX idx_notice_views_user_notice ON ProductNoticeViewState;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
