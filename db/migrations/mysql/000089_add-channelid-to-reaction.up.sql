SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ),
    'ALTER TABLE Reactions ADD COLUMN ChannelId varchar(26);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE Reactions SET ChannelId = (select ChannelId from Posts where Posts.Id = Reactions.PostId);
