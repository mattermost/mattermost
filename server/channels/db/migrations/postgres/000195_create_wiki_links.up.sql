-- Note: no foreign keys on SourceId/DestinationId/CreatorId by design. This
-- matches the project-wide MM convention (Channels, Users, ChannelMembers are
-- all FK-less for operational reasons: multi-shard/multi-region tolerance,
-- schema-evolution flexibility, and historical integer-vs-varchar id
-- compatibility). Integrity is enforced at the app layer via
-- cleanupWikiLinksForSourceChannel/DeleteByDestination on channel delete paths.
CREATE TABLE IF NOT EXISTS WikiLinks (
    SourceId      varchar(26) NOT NULL,
    DestinationId varchar(26) NOT NULL,
    CreateAt      bigint NOT NULL,
    CreatorId     varchar(26) DEFAULT NULL,
    PRIMARY KEY (SourceId, DestinationId)
);

SET lock_timeout = '5s';
ALTER TABLE ChannelMembers ADD COLUMN IF NOT EXISTS SourceId varchar(26) DEFAULT NULL;
RESET lock_timeout;
