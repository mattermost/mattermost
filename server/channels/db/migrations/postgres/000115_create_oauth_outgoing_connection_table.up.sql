CREATE TYPE oauthoutgoingconnection_granttype AS ENUM ('client_credentials');

CREATE TABLE IF NOT EXISTS oauthoutgoingconnection (
    id varchar(26) PRIMARY KEY,
    name varchar(64),
    clientid varchar(255),
    clientsecret varchar(255),
    oauthtokenurl text,
    granttype oauthoutgoingconnection_granttype DEFAULT 'client_credentials',
    audiences VARCHAR(1024)
);

CREATE INDEX IF NOT EXISTS idx_oauthoutgoingconnections_name ON oauthoutgoingconnection (name);
