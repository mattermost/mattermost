CREATE TABLE IF NOT EXISTS licenses (
    id VARCHAR(26) NOT NULL,
    createat bigint,
    bytes VARCHAR(10000),
    PRIMARY KEY (id)
);
