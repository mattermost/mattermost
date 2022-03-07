CREATE TABLE IF NOT EXISTS configurationfiles (
    name VARCHAR(64),
    data text NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL,
    PRIMARY KEY (name)
);