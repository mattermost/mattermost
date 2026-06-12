-- Posts and Drafts are the largest tables; 30s gives enough headroom for the
-- catalog-only rewrite while remaining bounded for DBA intervention.
SET lock_timeout = '30s';
ALTER TABLE Posts ALTER COLUMN Message TYPE TEXT;
ALTER TABLE Drafts ALTER COLUMN Message TYPE TEXT;
RESET lock_timeout;
