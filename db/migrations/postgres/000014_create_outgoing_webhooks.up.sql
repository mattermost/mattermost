CREATE TABLE IF NOT EXISTS outgoingwebhooks (
    id VARCHAR(26) PRIMARY KEY,
    token VARCHAR(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid VARCHAR(26),
    channelid VARCHAR(26),
    teamid VARCHAR(26),
    triggerwords VARCHAR(1024),
    callbackurls VARCHAR(1024),
    displayname VARCHAR(64)
);

ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS contenttype VARCHAR(128);
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS triggerwhen integer default 0;
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS username VARCHAR(64);
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS iconurl VARCHAR(1024);
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS description VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_team_id ON outgoingwebhooks (teamid);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_update_at ON outgoingwebhooks (updateat);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_create_at ON outgoingwebhooks (createat);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_delete_at ON outgoingwebhooks (deleteat);
