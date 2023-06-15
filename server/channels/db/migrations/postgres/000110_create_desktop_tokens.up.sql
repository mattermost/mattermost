CREATE TABLE IF NOT EXISTS desktoptokens (
    desktoptoken VARCHAR(64) NOT NULL,
    userid VARCHAR(26),
    createdat BIGINT NOT NULL,
    PRIMARY KEY (desktoptoken)
);
