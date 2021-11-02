CREATE TABLE IF NOT EXISTS status (
    userid VARCHAR(26) PRIMARY KEY,
    status VARCHAR(32),
    lastactivityat bigint
);

ALTER TABLE status ADD COLUMN IF NOT EXISTS manual boolean default false;
ALTER TABLE status DROP COLUMN IF EXISTS activechannel;

CREATE INDEX IF NOT EXISTS idx_status_status ON status(status);

ALTER TABLE status ADD COLUMN dndendtime bigint;
ALTER TABLE status ADD COLUMN prevstatus VARCHAR(32);

DROP INDEX IF EXISTS idx_status_user_id;
