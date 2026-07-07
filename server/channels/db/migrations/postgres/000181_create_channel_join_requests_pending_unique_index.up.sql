-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_channeljoinrequests_pending_unique
    ON ChannelJoinRequests (ChannelId, UserId)
    WHERE Status = 'pending';
