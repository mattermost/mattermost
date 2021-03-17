CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(26) PRIMARY KEY,
    token VARCHAR(26),
    createat bigint,
    expiresat bigint,
    lastactivityat bigint,
    userid VARCHAR(26),
    deviceid VARCHAR(512),
    roles VARCHAR(64),
    isoauth boolean,
    props VARCHAR(1000)
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expirednotify boolean default false;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (userid);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expiresat);
CREATE INDEX IF NOT EXISTS idx_sessions_create_at ON sessions (createat);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity_at ON sessions (lastactivityat);

DELETE FROM sessions where expiresat > 3000000000000;
