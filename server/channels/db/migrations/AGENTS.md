# Database Migration Review Guidelines

When reviewing or writing database migrations, enforce these rules to prevent
table locks and performance degradation on large production databases (100M+
posts). Schema migrations must ALWAYS be backwards compatible until the last
ESR.

## File Naming and Structure

Migration files follow the convention `{sequence_number}_{description}.{up|down}.sql`
and live in `db/migrations/{driver_name}/`. After creating migration files, run
`make migrations-extract` to update `db/migrations/migrations.list`. Merge
upstream before submitting a PR to avoid sequence number collisions.

## Index Creation and Deletion

Always use `CONCURRENTLY` for index operations. Without it, the operation
acquires a lock that blocks concurrent DML for the duration of index creation,
which can be minutes on large tables.

```sql
-- Wrong: blocks concurrent DML
CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar);

-- Correct: non-blocking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foo_bar ON foo (bar);

-- Same for drops
DROP INDEX CONCURRENTLY IF EXISTS idx_foo_bar;
```

## Adding Unique Constraints

Do not add a unique constraint directly. Create the index concurrently first,
then attach it:

```sql
CREATE UNIQUE INDEX CONCURRENTLY constraint_name ON foo (bar);
ALTER TABLE foo ADD UNIQUE USING INDEX constraint_name;
```

## Column Changes

- `ADD COLUMN` (nullable) is safe — metadata-only, no table rewrite.
- `ADD COLUMN` with a non-null `DEFAULT` is fast on Postgres 11+ but verify.
- `DROP COLUMN` is safe — metadata-only.
- `ALTER COLUMN` (type change) rewrites the entire table and blocks concurrent
  DML. Strongly avoid. A real-world example took 8+ hours on a large customer
  database. When unavoidable, use a multi-release phased approach:
  1. Release N: add the new column.
  2. Release N+1: backfill data via background jobs; use triggers for ongoing
     updates.
  3. Release N+2 (ESR): start using the new column in code.
  4. Release N+3 (ESR): drop the old column.

## Foreign Key Constraints

Avoid FK constraints. Adding a foreign key takes a SHARE ROW EXCLUSIVE lock,
limiting concurrent activity to SELECT queries only. If truly needed, consider
adding the constraint with `NOT VALID` to avoid the full-table scan under lock.

## Table Locking

Never write a migration that locks an entire table. Common operations that
acquire table-level locks:

- `ALTER COLUMN` (type change) — rewrites the table
- `CREATE INDEX` without `CONCURRENTLY`
- `ADD FOREIGN KEY` without `NOT VALID`
- `LOCK TABLE`

## Batch Updates

Never do a full-table `UPDATE` in a migration. Process data in batches:

```sql
UPDATE foo SET col = value
WHERE id IN (
  SELECT id FROM foo WHERE id > :offset ORDER BY id ASC LIMIT 100
);
```

Store the offset and resume across job runs.

## General Rules

- Each migration should do one thing. Don't combine unrelated schema changes.
- Prefer additive changes (new columns, new tables) over destructive ones.
- Test migrations against a database with realistic data volume, not just a
  dev-sized dataset. An EXPLAIN ANALYZE that looks fine on 12M posts may behave
  very differently at 100M posts.
- If a shipped migration is broken, do not modify it. Add a new corrective
  migration and make the original a no-op.
