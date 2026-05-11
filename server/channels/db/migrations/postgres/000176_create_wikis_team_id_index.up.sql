-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wikis_team_id ON Wikis(TeamId) WHERE DeleteAt = 0;
