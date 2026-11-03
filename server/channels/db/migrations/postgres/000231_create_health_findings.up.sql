CREATE TABLE IF NOT EXISTS healthfindings (
    fingerprint     varchar(32) PRIMARY KEY,
    code            varchar(64) NOT NULL,
    subject         varchar(255) NOT NULL DEFAULT '',
    scope           varchar(255) NOT NULL DEFAULT '',
    severity        varchar(16) NOT NULL,
    state           varchar(16) NOT NULL,
    area            varchar(64) NOT NULL,
    surface         varchar(16) NOT NULL DEFAULT 'product',
    messageid       varchar(128) NOT NULL DEFAULT '',
    details         jsonb NOT NULL DEFAULT '{}',
    firstseenat     bigint NOT NULL DEFAULT 0,
    lastseenat      bigint NOT NULL DEFAULT 0,
    statesince      bigint NOT NULL DEFAULT 0,
    consecutivehits integer NOT NULL DEFAULT 0,
    mutedat         bigint NOT NULL DEFAULT 0,
    mutedby         varchar(26) NOT NULL DEFAULT ''
);
