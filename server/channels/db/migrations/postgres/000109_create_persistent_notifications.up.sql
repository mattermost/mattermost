CREATE TABLE IF NOT EXISTS persistentnotifications (
    postid VARCHAR(26) PRIMARY KEY,
    createat bigint,
    lastsentat bigint,
    deleteat bigint,
    sentcount smallint
);
