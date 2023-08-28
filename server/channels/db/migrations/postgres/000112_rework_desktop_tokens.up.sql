DROP INDEX IF EXISTS idx_desktoptokens_createat;
DROP TABLE IF EXISTS desktoptokens;

CREATE TABLE IF NOT EXISTS desktoptokens (
    token VARCHAR(64) NOT NULL,
    createat BIGINT NOT NULL,
    userid VARCHAR(26) NOT NULL,    
    PRIMARY KEY (token)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_desktoptokens_token_createat ON desktoptokens(token, createat)
