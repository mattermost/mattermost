CREATE TABLE IF NOT EXISTS encryptionsessionkeys (
    sessionid VARCHAR(26) PRIMARY KEY,
    userid VARCHAR(26) NOT NULL,
    publickey TEXT NOT NULL,
    createat BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encryptionsessionkeys_userid ON encryptionsessionkeys(userid);
