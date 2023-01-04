CREATE TABLE IF NOT EXISTS persistentnotifications (
    postid VARCHAR(26) PRIMARY KEY,
    createat bigint,
    lastsentat bigint,
    deleteat bigint,
    sentcount smallint
);

CREATE INDEX IF NOT EXISTS idx_persistentnotifications_createat_deleteat ON persistentnotifications(createat, deleteat);