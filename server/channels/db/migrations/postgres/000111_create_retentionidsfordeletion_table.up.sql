CREATE TABLE IF NOT EXISTS retentionidsfordeletion (
    id varchar(26) PRIMARY KEY,
    tablename varchar(64),
    ids varchar(26)[]
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retentionidsfordeletion_tablename ON retentionidsfordeletion (tablename);
