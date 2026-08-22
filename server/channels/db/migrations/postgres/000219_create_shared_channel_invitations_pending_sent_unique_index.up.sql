-- morph:nontransactional
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sharedchannelinvitations_pending_sent_unique
    ON sharedchannelinvitations (channelid, remoteid)
    WHERE direction = 'sent' AND status = 'pending';
