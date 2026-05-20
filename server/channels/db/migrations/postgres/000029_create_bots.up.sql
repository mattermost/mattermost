CREATE TABLE IF NOT EXISTS bots (
    userid VARCHAR(26) PRIMARY KEY,
    description VARCHAR(1024),
    ownerid VARCHAR(190),
    createat bigint,
    updateat bigint,
    deleteat bigint
);

ALTER TABLE bots ADD COLUMN IF NOT EXISTS lasticonupdate bigint;
