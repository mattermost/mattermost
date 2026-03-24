DROP INDEX IF EXISTS idx_channels_auto_archive;

ALTER TABLE Channels
    DROP COLUMN IF EXISTS LastActivityAt,
    DROP COLUMN IF EXISTS AutoArchived;
