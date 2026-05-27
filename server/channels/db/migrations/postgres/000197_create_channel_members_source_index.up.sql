-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channelmembers_sourceid
    ON ChannelMembers(ChannelId, SourceId) WHERE SourceId IS NOT NULL;
