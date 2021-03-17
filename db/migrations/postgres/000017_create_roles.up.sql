CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(64),
    displayname VARCHAR(128),
    description VARCHAR(1024),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    permissions VARCHAR(4096),
    schememanaged boolean,
    UNIQUE(name)
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS builtin boolean DEFAULT false;

UPDATE Roles SET SchemeManaged = false
WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin');
