CREATE TABLE IF NOT EXISTS retentionidsfordeletion (
    id varchar(26) PRIMARY KEY,
    tablename varchar(64),
    ids varchar(26)[]
);

-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_retentionidsfordeletion_tablename ON retentionidsfordeletion (tablename);
