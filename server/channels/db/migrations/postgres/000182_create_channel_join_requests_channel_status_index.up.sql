-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channeljoinrequests_channel_status_createat
    ON ChannelJoinRequests (ChannelId, Status, CreateAt DESC);
