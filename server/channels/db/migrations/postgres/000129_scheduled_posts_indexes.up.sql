CREATE INDEX IF NOT EXISTS idx_scheduledposts_userid_channel_id_scheduled_at ON ScheduledPosts (UserId, ChannelId, ScheduledAt DESC);
CREATE INDEX IF NOT EXISTS idx_scheduledposts_scheduledat_id_id ON ScheduledPosts (ScheduledAt desc, Id);
CREATE INDEX IF NOT EXISTS idx_scheduledposts_id ON ScheduledPosts (Id);
