ALTER TABLE sharedchannelremotes DROP COLUMN IF EXISTS LastPostId;
ALTER TABLE sharedchannelremotes DROP COLUMN IF EXISTS LastPostUpdateAt;

DROP TABLE IF EXISTS sharedchannelremotes;
