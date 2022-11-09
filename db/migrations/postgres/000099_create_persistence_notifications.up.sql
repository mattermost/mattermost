CREATE TABLE IF NOT EXISTS persistencenotifications (
    postid VARCHAR(26) PRIMARY KEY,
    createat bigint,
    deleteat bigint
);

CREATE INDEX IF NOT EXISTS idx_persistencenotifications_createat_deleteat ON posts(createat, deleteat);