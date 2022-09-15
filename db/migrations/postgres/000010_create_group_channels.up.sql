CREATE TABLE IF NOT EXISTS groupchannels (
    groupid VARCHAR(26),
    autoadd boolean,
    schemeadmin boolean,
    createat bigint,
    deleteat bigint,
    updateat bigint,
    channelid VARCHAR(26),
    PRIMARY KEY(groupid, channelid)
);

ALTER TABLE groupchannels ADD COLUMN IF NOT EXISTS schemeadmin boolean;

CREATE INDEX IF NOT EXISTS idx_groupteams_schemeadmin ON groupchannels (schemeadmin);
CREATE INDEX IF NOT EXISTS idx_groupchannels_channelid ON groupchannels (channelid);
