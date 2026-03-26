# Database Migration Review Guidelines

When reviewing or writing database migrations, enforce these rules to prevent
table locks and performance degradation on large production databases (100M+
posts).

## Index Creation

Always use `CREATE INDEX CONCURRENTLY`. Never use plain `CREATE INDEX` in a
migration -- it acquires a full table lock that blocks reads and writes for the
duration of index creation, which can be minutes on large tables.

```sql
-- Wrong: locks the entire table
CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar);

-- Correct: builds the index without locking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foo_bar ON foo (bar);
```

## Table Locking

Never write a migration that locks an entire table. Common operations that lock
tables include:

- `ALTER TABLE ... ADD COLUMN` with a non-null default (use `ADD COLUMN` with
  `DEFAULT` only on Postgres 11+ where this is safe, but verify)
- `CREATE INDEX` without `CONCURRENTLY`
- `LOCK TABLE`

## General Rules

- Each migration should do one thing. Don't combine unrelated schema changes.
- Prefer additive changes (new columns, new tables) over destructive ones.
- Test migrations against a database with realistic data volume, not just a
  dev-sized dataset. An EXPLAIN ANALYZE that looks fine on 12M posts may behave
  very differently at 100M posts.
