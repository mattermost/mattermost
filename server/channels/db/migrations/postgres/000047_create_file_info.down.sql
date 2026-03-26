ALTER TABLE fileinfo DROP COLUMN IF EXISTS remoteid;

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_content_txt;
ALTER TABLE fileinfo DROP COLUMN IF EXISTS content;
ALTER TABLE fileinfo DROP COLUMN IF EXISTS minipreview;

-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_name_txt;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_extension_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_postid_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_delete_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_create_at;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_fileinfo_update_at;

DROP TABLE IF EXISTS fileinfo;
