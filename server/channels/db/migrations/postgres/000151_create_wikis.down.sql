DELETE FROM PropertyFields WHERE ID='pfwikipagesdefaultfield000';
DELETE FROM PropertyGroups WHERE ID='pgswikipagesdefaultgroup00';

DROP INDEX IF EXISTS idx_wikis_channel_id_delete_at;
DROP INDEX IF EXISTS idx_wikis_channel_id;
DROP TABLE IF EXISTS Wikis;
