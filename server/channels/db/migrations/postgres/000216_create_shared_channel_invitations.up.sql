CREATE TABLE IF NOT EXISTS sharedchannelinvitations (
    id character varying(26) NOT NULL,
    channelid character varying(26) NOT NULL,
    remoteid character varying(26) NOT NULL,
    direction character varying(10) NOT NULL,
    status character varying(20) NOT NULL,
    errmsg character varying(1024),
    creatorid character varying(26) NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL,
    PRIMARY KEY (id)
);
