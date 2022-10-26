ALTER TABLE threads DROP COLUMN IF EXISTS collectionid;
ALTER TABLE threads DROP COLUMN IF EXISTS collectiontype;
ALTER TABLE threads DROP COLUMN IF EXISTS topicid;
ALTER TABLE threads DROP COLUMN IF EXISTS topictype;
DROP INDEX IF EXISTS idx_threads_topictype_topicid;
