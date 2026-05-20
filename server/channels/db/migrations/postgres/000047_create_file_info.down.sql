ALTER TABLE fileinfo DROP COLUMN IF EXISTS remoteid;

DROP INDEX IF EXISTS idx_fileinfo_content_txt;
ALTER TABLE fileinfo DROP COLUMN IF EXISTS content;
ALTER TABLE fileinfo DROP COLUMN IF EXISTS minipreview;

DROP INDEX IF EXISTS idx_fileinfo_name_txt;
DROP INDEX IF EXISTS idx_fileinfo_extension_at;
DROP INDEX IF EXISTS idx_fileinfo_postid_at;
DROP INDEX IF EXISTS idx_fileinfo_delete_at;
DROP INDEX IF EXISTS idx_fileinfo_create_at;
DROP INDEX IF EXISTS idx_fileinfo_update_at;

DROP TABLE IF EXISTS fileinfo;
