CREATE TABLE IF NOT EXISTS MEChannelKeys (
    ChannelId  VARCHAR(26)  PRIMARY KEY,
    WrappedDEK BYTEA        NOT NULL,
    KeyId      VARCHAR(256) NOT NULL,
    CreateAt   BIGINT       NOT NULL,
    UpdateAt   BIGINT       NOT NULL
);

ALTER TABLE Channels
    ADD COLUMN IF NOT EXISTS Encrypted boolean NOT NULL DEFAULT false;
