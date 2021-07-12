CREATE TABLE IF NOT EXISTS audits (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    userid VARCHAR(26),
    action VARCHAR(512),
    extrainfo VARCHAR(1024),
    ipaddress VARCHAR(64),
    sessionid VARCHAR(26)
);

CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits (userid);
