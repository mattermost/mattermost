CREATE TABLE IF NOT EXISTS ChannelSyncLayouts (
    TeamId VARCHAR(26) PRIMARY KEY,
    Categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    UpdateAt BIGINT NOT NULL DEFAULT 0,
    UpdateBy VARCHAR(26) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ChannelSyncDismissals (
    UserId VARCHAR(26) NOT NULL,
    ChannelId VARCHAR(26) NOT NULL,
    TeamId VARCHAR(26) NOT NULL,
    PRIMARY KEY (UserId, ChannelId, TeamId)
);

CREATE INDEX IF NOT EXISTS idx_channelsyncdismissals_user_team ON ChannelSyncDismissals(UserId, TeamId);
