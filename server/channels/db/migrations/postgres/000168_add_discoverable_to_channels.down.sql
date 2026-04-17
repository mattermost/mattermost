DROP INDEX IF EXISTS idx_channeljoinrequests_channel_status;
DROP TABLE IF EXISTS channeljoinrequests;
ALTER TABLE channels DROP COLUMN IF EXISTS discoverable;
