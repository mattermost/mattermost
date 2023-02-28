CREATE TABLE IF NOT EXISTS sharedchannelattachments (
    id varchar(26) NOT NULL,
    fileid varchar(26),
    remoteid varchar(26),
    createat bigint,
    lastsyncat bigint,
    PRIMARY KEY (id),
    UNIQUE (fileid, remoteid)
);
