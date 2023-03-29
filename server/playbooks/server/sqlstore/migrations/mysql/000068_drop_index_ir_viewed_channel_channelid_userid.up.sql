SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_ViewedChannel'
        AND table_schema = DATABASE()
        AND index_name = 'IR_ViewedChannel_ChannelID_UserID'
    ) ,
    'DROP INDEX IR_ViewedChannel_ChannelID_UserID ON IR_ViewedChannel',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
