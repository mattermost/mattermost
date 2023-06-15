CREATE TABLE IF NOT EXISTS DesktopTokens (
    DesktopToken varchar(64) NOT NULL,
    UserId varchar(26) NULL,
    CreatedAt bigint NOT NULL,
    PRIMARY KEY (DesktopToken)
);