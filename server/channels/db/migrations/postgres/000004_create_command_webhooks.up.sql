CREATE TABLE IF NOT EXISTS commandwebhooks (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    commandid VARCHAR(26),
    userid VARCHAR(26),
    channelid VARCHAR(26),
    rootid VARCHAR(26),
    parentid VARCHAR(26),
    usecount integer
);

CREATE INDEX IF NOT EXISTS idx_command_webhook_create_at ON commandwebhooks (createat);
