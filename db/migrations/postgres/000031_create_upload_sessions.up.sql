CREATE TABLE IF NOT EXISTS uploadsessions (
    id VARCHAR(26) PRIMARY KEY,
    type VARCHAR(32),
    createat bigint,
    userid VARCHAR(26),
    channelid VARCHAR(26),
    filename VARCHAR(256),
    path VARCHAR(512),
    filesize bigint,
    fileoffset bigint
);

CREATE INDEX IF NOT EXISTS idx_uploadsessions_user_id ON uploadsessions(userid);
CREATE INDEX IF NOT EXISTS idx_uploadsessions_create_at ON uploadsessions(createat);
CREATE INDEX IF NOT EXISTS idx_uploadsessions_type ON uploadsessions(type);
