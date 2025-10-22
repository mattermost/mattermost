CREATE TABLE IF NOT EXISTS Wikis (
    Id VARCHAR(26) PRIMARY KEY,
    ChannelId VARCHAR(26) NOT NULL REFERENCES Channels(Id) ON DELETE CASCADE,
    Title VARCHAR(128) NOT NULL,
    Description TEXT,
    Icon VARCHAR(256),
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_wikis_channel_id ON Wikis(ChannelId);
CREATE INDEX idx_wikis_channel_id_delete_at ON Wikis(ChannelId) WHERE DeleteAt = 0;

-- Insert default PropertyGroup & Field
-- Using 26-character IDs as required by IsValidId validation
INSERT INTO PropertyGroups (ID, Name)
VALUES ('pgswikipagesdefaultgroup00', 'Pages')
ON CONFLICT (ID) DO NOTHING;

INSERT INTO PropertyFields (ID, GroupID, Name, Type, Attrs, TargetID, TargetType, CreateAt, UpdateAt, DeleteAt)
VALUES ('pfwikipagesdefaultfield000', 'pgswikipagesdefaultgroup00', 'wiki', 'text', '{}', NULL, NULL, EXTRACT(EPOCH FROM NOW()) * 1000, EXTRACT(EPOCH FROM NOW()) * 1000, 0)
ON CONFLICT (ID) DO NOTHING;

-- Add index for efficient wiki->pages queries
CREATE INDEX IF NOT EXISTS idx_propertyvalues_fieldid_value ON PropertyValues(FieldID, Value) WHERE DeleteAt = 0;
