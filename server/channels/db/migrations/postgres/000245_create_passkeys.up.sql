CREATE TABLE IF NOT EXISTS passkeys (
    id             varchar(26) PRIMARY KEY,
    userid         varchar(26) NOT NULL,
    userhandle     bytea NOT NULL,
    credentialid   bytea NOT NULL UNIQUE,
    publickey      bytea NOT NULL,
    aaguid         bytea NOT NULL DEFAULT ''::bytea,
    transports     varchar(255) NOT NULL DEFAULT '',
    signcount      bigint NOT NULL DEFAULT 0,
    backupeligible boolean NOT NULL DEFAULT false,
    backupstate    boolean NOT NULL DEFAULT false,
    name           varchar(64) NOT NULL,
    createat       bigint NOT NULL,
    lastusedat     bigint NOT NULL DEFAULT 0
);
