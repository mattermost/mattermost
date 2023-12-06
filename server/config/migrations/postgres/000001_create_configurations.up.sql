CREATE TABLE IF NOT EXISTS configurations (
    id varchar(26),
    value text NOT NULL,
    createat bigint NOT NULL,
    active boolean DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE (active)
);
