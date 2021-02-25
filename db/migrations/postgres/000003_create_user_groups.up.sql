CREATE TABLE IF NOT EXISTS usergroups (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(64),
    displayname VARCHAR(128),
    description VARCHAR(1024),
    source VARCHAR(64),
    remoteid VARCHAR(64),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    allowreference bool,
    UNIQUE(name),
    UNIQUE(source, remoteid)
);

CREATE INDEX IF NOT EXISTS idx_usergroups_remote_id ON usergroups (remoteid);
CREATE INDEX IF NOT EXISTS idx_usergroups_delete_at ON usergroups (deleteat);
