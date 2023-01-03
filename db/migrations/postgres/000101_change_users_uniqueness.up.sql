ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_authdata_key;

DROP INDEX IF EXISTS users_email_key;
DROP INDEX IF EXISTS users_username_key;
DROP INDEX IF EXISTS users_authdata_key;

CREATE UNIQUE INDEX users_email_key ON users (email) WHERE deleteat = 0;
CREATE UNIQUE INDEX users_username_key ON users (username) WHERE deleteat = 0;
CREATE UNIQUE INDEX users_authdata_key ON users (authdata) WHERE deleteat = 0;
