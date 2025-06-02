ALTER TABLE postacknowledgements ADD COLUMN remoteid VARCHAR(26) DEFAULT '';
ALTER TABLE postacknowledgements ADD COLUMN channelid VARCHAR(26) NOT NULL DEFAULT '';

UPDATE postacknowledgements pa
SET channelid = p.channelid
FROM posts p
WHERE pa.postid = p.id
AND pa.channelid = '';

ALTER TABLE postacknowledgements ALTER COLUMN channelid DROP DEFAULT;

CREATE INDEX idx_post_acknowledgements_postid_remoteid ON postacknowledgements(postid, remoteid);