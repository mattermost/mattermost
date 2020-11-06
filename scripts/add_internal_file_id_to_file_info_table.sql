ALTER TABLE FileInfo ADD COLUMN `InternalFileID` varchar(64) NOT NULL DEFAULT '' COMMENT 'internal encrypted fileID';
ALTER TABLE FileInfo ADD COLUMN `InternalThumbnailID` varchar(64) NOT NULL DEFAULT '' COMMENT 'internal encrypted fileID';
ALTER TABLE FileInfo ADD COLUMN `InternalPreviewID` varchar(64) NOT NULL DEFAULT '' COMMENT 'internal encrypted fileID';
