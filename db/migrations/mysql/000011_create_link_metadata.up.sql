CREATE TABLE IF NOT EXISTS LinkMetadata (
    Hash bigint(20) NOT NULL,
    URL text,
    Timestamp bigint(20) DEFAULT NULL,
    Type varchar(16) DEFAULT NULL,
    Data text,
    PRIMARY KEY (Hash),
    KEY idx_link_metadata_url_timestamp (URL(512),Timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
