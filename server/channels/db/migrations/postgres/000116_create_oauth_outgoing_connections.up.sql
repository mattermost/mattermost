CREATE TYPE oauthoutgoingconnections_granttype AS ENUM ('client_credentials', 'password');

CREATE TABLE IF NOT EXISTS oauthoutgoingconnections (
    id varchar(26) PRIMARY KEY,
    name varchar(64),
    creatorid VARCHAR(26),
    createat bigint,
    updateat bigint,
    clientid varchar(255),
    clientsecret varchar(255),
    credentialsusername varchar(255),
    credentialspassword varchar(255),
    oauthtokenurl text,
    granttype oauthoutgoingconnections_granttype DEFAULT 'client_credentials',
    audiences VARCHAR(1024)
);

CREATE INDEX IF NOT EXISTS idx_oauthoutgoingconnections_name ON oauthoutgoingconnections (name);
