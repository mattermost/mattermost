CREATE TABLE IF NOT EXISTS sharedchannelusers (
    id varchar(26) NOT NULL,
    userid varchar(26),
    channelid varchar(26),
    remoteid varchar(26),
    createat bigint,
    lastsyncat bigint,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sharedchannelusers_remote_id ON sharedchannelusers (remoteid);
CREATE INDEX IF NOT EXISTS idx_sharedchannelusers_user_id ON sharedchannelusers (userid);

ALTER TABLE sharedchannelusers ADD COLUMN IF NOT EXISTS channelid varchar(26) DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
       SELECT conname
       FROM pg_constraint
       WHERE conname = 'sharedchannelusers_userid_channelid_remoteid_key'
    )
    THEN
        ALTER TABLE sharedchannelusers ADD CONSTRAINT sharedchannelusers_userid_channelid_remoteid_key UNIQUE (userid, channelid, remoteid);
    END IF;
END $$;
