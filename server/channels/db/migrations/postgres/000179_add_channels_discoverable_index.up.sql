-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channels_discoverable_team
    ON Channels (TeamId)
    WHERE Discoverable = true AND Type = 'P' AND DeleteAt = 0;
