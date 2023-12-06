SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ProductNoticeViewState'
        AND table_schema = DATABASE()
        AND index_name = 'idx_notice_views_user_notice'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_notice_views_user_notice ON ProductNoticeViewState(UserId, NoticeId);'
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
    'SELECT 1',
    'CREATE INDEX idx_notice_views_user_id ON ProductNoticeViewState(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS ProductNoticeViewState;
