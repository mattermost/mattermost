CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar);
CREATE UNIQUE INDEX IF NOT EXISTS idx_foo_baz ON foo (baz);
DROP INDEX IF EXISTS idx_foo_old;
