DROP INDEX IF EXISTS remote_clusters_site_url_unique;
ALTER TABLE remoteclusters ADD COLUMN IF NOT EXISTS deleteat bigint DEFAULT 0;

ALTER TABLE sharedchannelremotes ADD COLUMN IF NOT EXISTS deleteat bigint DEFAULT 0;
