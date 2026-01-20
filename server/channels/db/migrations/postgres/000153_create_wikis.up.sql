CREATE TABLE IF NOT EXISTS Wikis (
    Id VARCHAR(26) PRIMARY KEY,
    ChannelId VARCHAR(26) NOT NULL REFERENCES Channels(Id) ON DELETE CASCADE,
    Title VARCHAR(128) NOT NULL,
    Description TEXT,
    Icon VARCHAR(256),
    Props JSONB DEFAULT '{}',
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT NOT NULL DEFAULT 0,
    SortOrder BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_wikis_channel_id ON Wikis(ChannelId);
CREATE INDEX idx_wikis_channel_id_delete_at ON Wikis(ChannelId) WHERE DeleteAt = 0;
CREATE INDEX idx_wikis_props ON Wikis USING GIN (Props);
