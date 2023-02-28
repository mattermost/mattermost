CREATE TABLE IF NOT EXISTS linkmetadata (
    hash bigint NOT NULL,
    url VARCHAR(2048),
    "timestamp" bigint,
    type VARCHAR(16),
    data VARCHAR(4096),
    PRIMARY KEY (hash)
);

CREATE INDEX IF NOT EXISTS idx_link_metadata_url_timestamp ON linkmetadata (url, "timestamp");
