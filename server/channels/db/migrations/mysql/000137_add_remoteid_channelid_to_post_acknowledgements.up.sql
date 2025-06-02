ALTER TABLE PostAcknowledgements ADD COLUMN RemoteId varchar(26) DEFAULT '';
ALTER TABLE PostAcknowledgements ADD COLUMN ChannelId varchar(26) NOT NULL DEFAULT '';

UPDATE PostAcknowledgements pa
INNER JOIN Posts p ON pa.PostId = p.Id
SET pa.ChannelId = p.ChannelId
WHERE pa.ChannelId = '';

ALTER TABLE PostAcknowledgements MODIFY COLUMN ChannelId varchar(26) NOT NULL;

CREATE INDEX idx_post_acknowledgements_postid_remoteid ON PostAcknowledgements(PostId, RemoteId);