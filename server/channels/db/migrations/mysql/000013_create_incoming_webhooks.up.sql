CREATE TABLE IF NOT EXISTS IncomingWebhooks (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    ChannelId varchar(26) DEFAULT NULL,
    TeamId varchar(26) DEFAULT NULL,
    DisplayName varchar(64) DEFAULT NULL,
    Description varchar(128) DEFAULT NULL,
    Username varchar(64) DEFAULT NULL,
    PRIMARY KEY(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Username'
    ) > 0,
    'ALTER TABLE IncomingWebhooks MODIFY Username VARCHAR(255);',
    'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'IconURL'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE IncomingWebhooks ADD IconURL text;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelLocked'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE IncomingWebhooks ADD ChannelLocked tinyint(1) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Description'
    ) > 0,
    'ALTER TABLE IncomingWebhooks MODIFY Description TEXT;',
    'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_incoming_webhook_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_incoming_webhook_user_id ON IncomingWebhooks (UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_incoming_webhook_team_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_incoming_webhook_team_id ON IncomingWebhooks (TeamId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_incoming_webhook_update_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_incoming_webhook_update_at ON IncomingWebhooks (UpdateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_incoming_webhook_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_incoming_webhook_create_at ON IncomingWebhooks (CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_incoming_webhook_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_incoming_webhook_delete_at ON IncomingWebhooks (DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

CREATE PROCEDURE CheckColumnMaxLength(
    in columnName varchar(45),
    in threshold int )
BEGIN
    DECLARE C INT;

    SELECT COALESCE(
        SUM(
            CASE
            WHEN CHAR_LENGTH(columnName) > threshold THEN 1
            ELSE 0
            END
        ),
    0) INTO C
    FROM IncomingWebhooks;

    IF(C > 0) THEN
        SET @messageText = CONCAT('IncomingWebhooks column ', columnName, ' has data larger that ', threshold, ' characters');
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = @messageText;
    END IF;
END;

CALL CheckColumnMaxLength('Username', 255);
CALL CheckColumnMaxLength('IconURL',  1024);

DROP PROCEDURE IF EXISTS CheckColumnMaxLength;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IncomingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Description'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE IncomingWebhooks MODIFY COLUMN Description text;',
    'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
