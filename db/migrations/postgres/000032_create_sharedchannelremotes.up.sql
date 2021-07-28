CREATE TABLE IF NOT EXISTS sharedchannelremotes (
    id character varying(26) NOT NULL,
    channelid character varying(26) NOT NULL,
    description character varying(64),
    creatorid character varying(26),
    createat bigint,
    updateat bigint,
    isinviteaccepted boolean,
    isinviteconfirmed boolean,
    remoteid character varying(26),
    nextsyncat bigint,
    PRIMARY KEY(id, channelid),
    UNIQUE(channelid, remoteid)
);
