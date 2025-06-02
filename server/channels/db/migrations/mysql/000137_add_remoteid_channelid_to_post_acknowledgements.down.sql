DROP INDEX idx_post_acknowledgements_postid_remoteid ON PostAcknowledgements;
ALTER TABLE PostAcknowledgements DROP COLUMN RemoteId;
ALTER TABLE PostAcknowledgements DROP COLUMN ChannelId;