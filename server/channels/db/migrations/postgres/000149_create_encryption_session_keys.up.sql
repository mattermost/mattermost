CREATE TABLE IF NOT EXISTS EncryptionSessionKeys (
    SessionId VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    PublicKey TEXT NOT NULL,
    CreateAt BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encryption_session_keys_user_id ON EncryptionSessionKeys(UserId);
