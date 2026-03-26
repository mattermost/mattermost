CREATE TABLE IF NOT EXISTS fileinfo (
    id VARCHAR(26) PRIMARY KEY,
    creatorid VARCHAR(26),
    postid VARCHAR(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    path VARCHAR(512),
    thumbnailpath VARCHAR(512),
    previewpath VARCHAR(512),
    name VARCHAR(256),
    extension VARCHAR(64),
    size bigint,
    mimetype VARCHAR(256),
    width integer,
    height integer,
    haspreviewimage boolean
);

-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_update_at ON fileinfo (updateat);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_create_at ON fileinfo (createat);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_delete_at ON fileinfo (deleteat);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_postid_at ON fileinfo (postid);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_extension_at ON fileinfo (extension);
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_name_txt ON fileinfo USING gin(to_tsvector('english', name));

ALTER TABLE fileinfo ADD COLUMN IF NOT EXISTS minipreview bytea;
ALTER TABLE fileinfo ADD COLUMN IF NOT EXISTS content text;

-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_content_txt ON fileinfo USING gin(to_tsvector('english', content));
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_fileinfo_name_splitted ON fileinfo USING gin (to_tsvector('english'::regconfig, translate((name)::text, '.,-'::text, '   '::text)));

ALTER TABLE fileinfo ADD COLUMN IF NOT EXISTS remoteid varchar(26);
