-- While upgrading from 5.x to 6.x with manual queries, there is a chance that this
-- migration is skipped. In that case, we need to make sure that the column is dropped.

ALTER TABLE posts DROP COLUMN IF EXISTS parentid;
