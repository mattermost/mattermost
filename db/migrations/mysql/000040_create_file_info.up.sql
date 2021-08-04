CREATE TABLE IF NOT EXISTS FileInfo (
    Id varchar(26) NOT NULL,
    CreatorId varchar(26) DEFAULT NULL,
    PostId varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    Path text,
    ThumbnailPath text,
    PreviewPath text,
    Name text,
    Extension varchar(64) DEFAULT NULL,
    Size bigint(20) DEFAULT NULL,
    MimeType text,
    Width int(11) DEFAULT NULL,
    Height int(11) DEFAULT NULL,
    HasPreviewImage tinyint(1) DEFAULT NULL,
    PRIMARY KEY (Id),
    KEY idx_fileinfo_update_at (UpdateAt),
    KEY idx_fileinfo_create_at (CreateAt),
    KEY idx_fileinfo_delete_at (DeleteAt),
    KEY idx_fileinfo_postid_at (PostId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND index_name = 'idx_fileinfo_extension_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_fileinfo_extension_at ON FileInfo (Extension);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND index_name = 'idx_fileinfo_name_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_fileinfo_name_txt ON FileInfo (Name);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'MiniPreview'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE FileInfo ADD MiniPreview mediumblob;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'Content'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE FileInfo ADD Content longtext;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND index_name = 'idx_fileinfo_content_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_fileinfo_content_txt ON FileInfo (Content);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE FileInfo ADD COLUMN RemoteId varchar(26);'
));

PREPARE alterNotIfExists FROM @preparedStatement;
EXECUTE alterNotIfExists;
DEALLOCATE PREPARE alterNotIfExists;
