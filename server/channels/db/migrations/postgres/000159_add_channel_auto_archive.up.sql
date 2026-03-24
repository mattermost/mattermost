-- Migration: 000159_add_channel_auto_archive
-- Adds support for the channel auto-archive feature.
--
-- Changes:
--   1. Adds `LastActivityAt` column to Channels — tracks the timestamp of the
--      most recent post in a channel, used by the auto-archive background job.
--   2. Adds `AutoArchived` boolean column — distinguishes channels archived by
--      the auto-archive job from channels manually archived by admins.
--   3. Creates an index on (LastActivityAt, Type) for efficient job queries.

ALTER TABLE Channels
    ADD COLUMN IF NOT EXISTS LastActivityAt BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS AutoArchived   BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill LastActivityAt from the most recent post in each channel.
UPDATE Channels c
   SET LastActivityAt = COALESCE(
       (SELECT MAX(p.CreateAt)
          FROM Posts p
         WHERE p.ChannelId = c.Id
           AND p.DeleteAt  = 0),
       c.CreateAt
   );

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channels_auto_archive
    ON Channels (LastActivityAt, Type)
    WHERE DeleteAt = 0 AND AutoArchived = FALSE;
