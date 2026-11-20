-- morph:nontransactional
-- Finding each channel's admins otherwise reads every member of the channel,
-- which is slow across thousands of large channels. Only admins are indexed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channelmembers_channel_id_scheme_admin ON ChannelMembers (ChannelId, UserId) WHERE SchemeAdmin = true;
