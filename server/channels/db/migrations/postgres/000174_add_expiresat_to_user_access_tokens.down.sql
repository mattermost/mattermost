DROP INDEX CONCURRENTLY IF EXISTS idx_useraccesstokens_expiresat;

ALTER TABLE useraccesstokens DROP COLUMN IF EXISTS expiresat;
