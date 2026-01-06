CREATE TABLE IF NOT EXISTS ChannelRelationships (
    Id VARCHAR(26) PRIMARY KEY,
    SourceChannelId VARCHAR(26) NOT NULL,
    TargetChannelId VARCHAR(26) NOT NULL,
    RelationshipType VARCHAR(32) NOT NULL,
    CreatedAt BIGINT NOT NULL,
    Metadata JSONB,

    CONSTRAINT fk_channel_rel_source FOREIGN KEY (SourceChannelId) REFERENCES Channels(Id) ON DELETE CASCADE,
    CONSTRAINT fk_channel_rel_target FOREIGN KEY (TargetChannelId) REFERENCES Channels(Id) ON DELETE CASCADE,
    CONSTRAINT uq_channel_rel_source_target_type UNIQUE (SourceChannelId, TargetChannelId, RelationshipType)
);

CREATE INDEX IF NOT EXISTS idx_channel_rel_source ON ChannelRelationships(SourceChannelId);
CREATE INDEX IF NOT EXISTS idx_channel_rel_target ON ChannelRelationships(TargetChannelId);
