CREATE TABLE IF NOT EXISTS postentities (
    postid varchar(26) PRIMARY KEY,
    channelid varchar(26) NOT NULL,
    messagehash varchar(64) NOT NULL,
    patterngeneration varchar(64) NOT NULL,
    protectedranges jsonb NOT NULL DEFAULT '[]',
    entities jsonb NOT NULL DEFAULT '[]',
    skipped boolean NOT NULL DEFAULT false,
    updateat bigint NOT NULL,
    CONSTRAINT fk_postentities_postid FOREIGN KEY (postid) REFERENCES Posts(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_postentities_channelid_updateat ON postentities (channelid, updateat);
