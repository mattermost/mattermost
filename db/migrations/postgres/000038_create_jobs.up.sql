CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(26) PRIMARY KEY,
    type VARCHAR(32),
    priority bigint,
    createat bigint,
    startat bigint,
    lastactivityat bigint,
    status VARCHAR(32),
    progress bigint,
    data VARCHAR(1024)
);

CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs (type);
