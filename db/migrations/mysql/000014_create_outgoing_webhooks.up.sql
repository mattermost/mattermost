CREATE TABLE IF NOT EXISTS OutgoingWebhooks (
    Id varchar(26) NOT NULL,
    Token varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    CreatorId varchar(26) DEFAULT NULL,
    ChannelId varchar(26) DEFAULT NULL,
    TeamId varchar(26) DEFAULT NULL,
    TriggerWords text,
    CallbackURLs text,
    DisplayName varchar(64) DEFAULT NULL,
    PRIMARY KEY(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'ContentType'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OutgoingWebhooks ADD ContentType VARCHAR(128);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'TriggerWhen'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OutgoingWebhooks ADD TriggerWhen int(11) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Username'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OutgoingWebhooks ADD Username VARCHAR(64) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'IconURL'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OutgoingWebhooks ADD IconURL text;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'Description'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE OutgoingWebhooks ADD Description text;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_outgoing_webhook_team_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_outgoing_webhook_team_id ON OutgoingWebhooks (TeamId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_outgoing_webhook_update_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_outgoing_webhook_update_at ON OutgoingWebhooks (UpdateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_outgoing_webhook_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_outgoing_webhook_create_at ON OutgoingWebhooks (CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OutgoingWebhooks'
        AND table_schema = DATABASE()
        AND index_name = 'idx_outgoing_webhook_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_outgoing_webhook_delete_at ON OutgoingWebhooks (DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
