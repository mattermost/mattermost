ALTER TABLE threads ADD COLUMN IF NOT EXISTS collectiontype character varying(26);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS collectionid character varying(64);

ALTER TABLE threads ADD COLUMN IF NOT EXISTS topictype character varying(26);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS topicid character varying(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_topictype_topicid ON threads (topictype, topicid);
