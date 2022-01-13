CREATE TABLE IF NOT EXISTS oauthapps (
    id VARCHAR(26) PRIMARY KEY,
    creatorid VARCHAR(26),
    createat bigint,
    updateat bigint,
    clientsecret VARCHAR(128),
    name VARCHAR(64),
    description VARCHAR(512),
    callbackurls VARCHAR(1024),
    homepage VARCHAR(256)
);

CREATE INDEX IF NOT EXISTS idx_oauthapps_creator_id ON oauthapps (creatorid);

ALTER TABLE oauthapps ADD COLUMN IF NOT EXISTS istrusted boolean;
ALTER TABLE oauthapps ADD COLUMN IF NOT EXISTS iconurl VARCHAR(512);
