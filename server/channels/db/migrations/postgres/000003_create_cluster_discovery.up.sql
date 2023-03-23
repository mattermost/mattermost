CREATE TABLE IF NOT EXISTS clusterdiscovery (
    id VARCHAR(26) PRIMARY KEY,
    type VARCHAR(64),
    clustername VARCHAR(64),
    hostname VARCHAR(512),
    gossipport integer,
    port integer,
    createat bigint,
    lastpingat bigint
);
