CREATE TABLE IF NOT EXISTS desktoptokens (
    desktoptoken VARCHAR(64) NOT NULL,
    userid VARCHAR(26),
    createat BIGINT NOT NULL,
    PRIMARY KEY (desktoptoken)
);

CREATE INDEX IF NOT EXISTS idx_desktoptokens_createat ON desktoptokens(createat);