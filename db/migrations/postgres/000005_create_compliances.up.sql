CREATE TABLE IF NOT EXISTS compliances (
    id VARCHAR(26) NOT NULL,
    createat bigint,
    userid VARCHAR(26),
    status VARCHAR(64),
    count integer,
    "desc" VARCHAR(512),
    type VARCHAR(64),
    startat bigint,
    endat bigint,
    keywords VARCHAR(512),
    emails VARCHAR(1024),
    PRIMARY KEY (id)
);
