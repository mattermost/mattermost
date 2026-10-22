-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channeljoinrequests_user_status_createat
    ON ChannelJoinRequests (UserId, Status, CreateAt DESC);
