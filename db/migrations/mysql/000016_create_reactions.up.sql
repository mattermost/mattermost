CREATE TABLE IF NOT EXISTS Reactions (
    UserId varchar(26) NOT NULL,
    PostId varchar(26) NOT NULL,
    EmojiName varchar(64) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND column_name = 'UpdateAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Reactions ADD COLUMN UpdateAt bigint(20);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Reactions ADD COLUMN DeleteAt bigint(20);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

CREATE PROCEDURE AlterPrimaryKey()
BEGIN
    DECLARE existingPK varchar(26) default '';

    SELECT IFNULL(GROUP_CONCAT(column_name ORDER BY seq_in_index), '') INTO existingPK
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'Reactions'
    AND index_name = 'PRIMARY'
    GROUP BY index_name;

    IF existingPK != 'PostId,UserId,EmojiName' THEN
        IF existingPk != '' THEN
            ALTER TABLE Reactions DROP PRIMARY KEY;
        END IF;

        ALTER TABLE Reactions ADD PRIMARY KEY (PostId, UserID, EmojiName);
    END IF;
END;

CALL AlterPrimaryKey();

DROP PROCEDURE IF EXISTS AlterPrimaryKey;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Reactions ADD COLUMN RemoteId varchar(26);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
