CREATE TABLE IF NOT EXISTS channelbookmarks (
    id varchar(26) PRIMARY KEY,
    ownerid varchar(26) NOT NULL,
    channelid varchar(26) NOT NULL,
    fileinfoid varchar(26) DEFAULT NULL,
    createat bigint DEFAULT 0,
    updateat bigint DEFAULT 0,
    deleteat bigint DEFAULT 0,
    displayname text DEFAULT '',
    sortorder integer DEFAULT 0,
    linkurl text DEFAULT NULL,
    imageurl text DEFAULT NULL,
    emoji varchar(64) DEFAULT NULL,
    type varchar(26) DEFAULT 'link',
    originalid varchar(26) DEFAULT NULL,
    parentid varchar(26) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_channelbookmarks_channelid ON channelbookmarks (channelid);
CREATE INDEX IF NOT EXISTS idx_channelbookmarks_update_at ON channelbookmarks (updateat);
CREATE INDEX IF NOT EXISTS idx_channelbookmarks_delete_at ON channelbookmarks (deleteat);
