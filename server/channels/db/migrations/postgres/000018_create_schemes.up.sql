CREATE TABLE IF NOT EXISTS schemes (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(64),
    displayname VARCHAR(128),
    description VARCHAR(1024),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    scope VARCHAR(32),
    defaultteamadminrole VARCHAR(64),
    defaultteamuserrole VARCHAR(64),
    defaultchanneladminrole VARCHAR(64),
    defaultchanneluserrole VARCHAR(64),
    UNIQUE(name)
);

ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultteamguestrole VARCHAR(64);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultchannelguestrole VARCHAR(64);

ALTER TABLE schemes ALTER COLUMN defaultteamguestrole TYPE VARCHAR(64);
ALTER TABLE schemes ALTER COLUMN defaultchannelguestrole TYPE VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_schemes_channel_guest_role ON schemes (defaultchannelguestrole);
CREATE INDEX IF NOT EXISTS idx_schemes_channel_user_role ON schemes (defaultchanneluserrole);
CREATE INDEX IF NOT EXISTS idx_schemes_channel_admin_role ON schemes (defaultchanneladminrole);
