CREATE TABLE IF NOT EXISTS statuslogs (
    id VARCHAR(26) PRIMARY KEY,
    createat BIGINT NOT NULL,
    userid VARCHAR(26) NOT NULL,
    username VARCHAR(64) NOT NULL,
    oldstatus VARCHAR(32) NOT NULL DEFAULT '',
    newstatus VARCHAR(32) NOT NULL DEFAULT '',
    reason VARCHAR(64) NOT NULL DEFAULT '',
    windowactive BOOLEAN NOT NULL DEFAULT FALSE,
    channelid VARCHAR(26) NOT NULL DEFAULT '',
    device VARCHAR(32) NOT NULL DEFAULT 'unknown',
    logtype VARCHAR(32) NOT NULL DEFAULT 'status_change',
    trigger VARCHAR(128) NOT NULL DEFAULT '',
    manual BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(128) NOT NULL DEFAULT ''
);

-- Index for filtering by user
CREATE INDEX IF NOT EXISTS idx_statuslogs_userid ON statuslogs(userid);

-- Index for filtering by time (for pagination and retention cleanup)
CREATE INDEX IF NOT EXISTS idx_statuslogs_createat ON statuslogs(createat);

-- Index for filtering by log type
CREATE INDEX IF NOT EXISTS idx_statuslogs_logtype ON statuslogs(logtype);

-- Composite index for common query patterns (user + time)
CREATE INDEX IF NOT EXISTS idx_statuslogs_userid_createat ON statuslogs(userid, createat DESC);

-- Composite index for filtering by type and time
CREATE INDEX IF NOT EXISTS idx_statuslogs_logtype_createat ON statuslogs(logtype, createat DESC);
