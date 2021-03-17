CREATE TABLE IF NOT EXISTS tokens (
    token VARCHAR(64) PRIMARY KEY,
    createat bigint,
    type VARCHAR(64),
    extra VARCHAR(2048)
);

ALTER TABLE tokens ALTER COLUMN extra TYPE VARCHAR(2048);
