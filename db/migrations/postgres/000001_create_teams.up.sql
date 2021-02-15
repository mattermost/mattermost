CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(26) PRIMARY KEY,
    displayname VARCHAR(64),
    name VARCHAR(64),
    description VARCHAR(255),
    email VARCHAR(128),
    type VARCHAR(255),
    companyname VARCHAR(64),
    alloweddomains VARCHAR(1000),
    inviteid VARCHAR(32),
    schemeid VARCHAR(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    UNIQUE(name)
);
