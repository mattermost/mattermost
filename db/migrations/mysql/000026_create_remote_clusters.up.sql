CREATE TABLE IF NOT EXISTS RemoteClusters (
    RemoteId VARCHAR(26) NOT NULL,
    RemoteTeamId VARCHAR(26),
    DisplayName VARCHAR(64),
    SiteURL VARCHAR(168),
    CreateAt bigint,
    UpdateAt bigint,
    Token VARCHAR(26) NOT NULL,
    RemoteToken VARCHAR(26),
    Topics VARCHAR(512),
    CreatorId VARCHAR(26) NOT NULL,
    PRIMARY KEY (RemoteId),
    UNIQUE KEY (RemoteTeamId, SiteURL)
);
