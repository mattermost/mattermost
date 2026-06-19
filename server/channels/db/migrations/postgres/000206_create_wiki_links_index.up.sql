-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wikilinks_destinationid
    ON WikiLinks(DestinationId);
