SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_ViewedChannel'
        AND table_schema = DATABASE()
        AND index_name = 'IR_ViewedChannel_ChannelID_UserID'
    ) ,
    'CREATE UNIQUE INDEX IR_ViewedChannel_ChannelID_UserID ON IR_ViewedChannel (ChannelID, UserID)',
    'SELECT 1'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
