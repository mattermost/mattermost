CREATE INDEX IF NOT EXISTS idx_user_access_tokens_token ON useraccesstokens (token);

DROP TABLE IF EXISTS useraccesstokens;
