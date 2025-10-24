-- Recaps table: stores recap metadata
CREATE TABLE IF NOT EXISTS Recaps (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    Title VARCHAR(255) NOT NULL,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT NOT NULL,
    TotalMessageCount INT NOT NULL,
    Status VARCHAR(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recaps_user_id ON Recaps(UserId);
CREATE INDEX IF NOT EXISTS idx_recaps_create_at ON Recaps(CreateAt);
CREATE INDEX IF NOT EXISTS idx_recaps_user_id_delete_at ON Recaps(UserId, DeleteAt);

-- RecapChannels table: stores per-channel summaries
CREATE TABLE IF NOT EXISTS RecapChannels (
    Id VARCHAR(26) PRIMARY KEY,
    RecapId VARCHAR(26) NOT NULL,
    ChannelId VARCHAR(26) NOT NULL,
    ChannelName VARCHAR(64) NOT NULL,
    Highlights TEXT,
    ActionItems TEXT,
    SourcePostIds TEXT,
    CreateAt BIGINT NOT NULL,
    FOREIGN KEY (RecapId) REFERENCES Recaps(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recap_channels_recap_id ON RecapChannels(RecapId);
CREATE INDEX IF NOT EXISTS idx_recap_channels_channel_id ON RecapChannels(ChannelId);


