CREATE TABLE IF NOT EXISTS termsofservice (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    userid VARCHAR(26),
    text VARCHAR(65535)
);
