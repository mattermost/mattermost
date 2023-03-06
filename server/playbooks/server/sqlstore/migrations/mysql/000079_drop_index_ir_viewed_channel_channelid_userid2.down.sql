SELECT 1;

-- we retroactively dropped this index in "0.29.0 > 0.30.0" to fix the blocked migration, 
-- and then repeated it in a new migration("0.35.0 > 0.36.0") too so that the schemas remain in sync.
-- so we don't need to restore index here

-- SET @preparedStatement = (SELECT IF(
--     NOT EXISTS(
--         SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
--         WHERE table_name = 'IR_ViewedChannel'
--         AND table_schema = DATABASE()
--         AND index_name = 'IR_ViewedChannel_ChannelID_UserID'
--     ) ,
--     'CREATE UNIQUE INDEX IR_ViewedChannel_ChannelID_UserID ON IR_ViewedChannel (ChannelID, UserID)',
--     'SELECT 1'
-- ));

-- PREPARE createIndexIfNotExists FROM @preparedStatement;
-- EXECUTE createIndexIfNotExists;
-- DEALLOCATE PREPARE createIndexIfNotExists;
