DROP INDEX IF EXISTS idx_post_acknowledgements_postid_remoteid;
ALTER TABLE postacknowledgements DROP COLUMN remoteid;
ALTER TABLE postacknowledgements DROP COLUMN channelid;