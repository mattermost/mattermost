-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channelmemberlinks_destinationid
    ON ChannelMemberLinks(DestinationId);
