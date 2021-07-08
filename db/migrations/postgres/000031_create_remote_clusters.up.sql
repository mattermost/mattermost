CREATE TABLE IF NOT EXISTS remoteclusters (
    remoteid VARCHAR(26) NOT NULL,
    remoteteamid VARCHAR(26),
    displayname VARCHAR(64),
    siteurl VARCHAR(512),
    createat bigint,
    updateat bigint,
    token VARCHAR(26) NOT NULL,
    remotetoken VARCHAR(26),
    topics VARCHAR(512),
    creatorid VARCHAR(26) NOT NULL,
    PRIMARY KEY (remoteid),
    UNIQUE (remoteteamid, siteurl)
);
