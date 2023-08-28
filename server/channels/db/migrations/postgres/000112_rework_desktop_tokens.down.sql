DROP INDEX IF EXISTS idx_desktoptokens_token_createat;
DROP TABLE IF EXISTS desktoptokens;

CREATE TABLE IF NOT EXISTS desktoptokens (
    desktoptoken VARCHAR(64) NOT NULL,
    servertoken VARCHAR(64),
    userid VARCHAR(26),
    createat BIGINT NOT NULL,
    PRIMARY KEY (desktoptoken)
);

CREATE INDEX IF NOT EXISTS idx_desktoptokens_createat ON desktoptokens(createat);
