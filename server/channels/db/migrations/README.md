# Database Migration Rules

Enforce these rules to prevent table locks and performance degradation on large production databases (100M+ posts).

## General Rules

- Each migration should do one thing. Don't combine unrelated schema changes.
- Prefer additive changes (new columns, new tables) over destructive ones.
- Schema migrations must **ALWAYS** be backwards compatible until the last ESR.
- Test migrations against a database with realistic data volume, not just a dev-sized dataset. An `EXPLAIN ANALYZE` that looks fine on 12M posts may behave very differently at 100M posts.
- If a shipped migration is broken, do not modify it. Add a new migration to correct.

## File Naming and Structure

Migration files follow the convention `{sequence_number}_{description}.{up|down}.sql` and live in `db/migrations/{driver_name}/`. After creating migration files, run `make migrations-extract` to update `db/migrations/migrations.list`. Merge upstream before submitting a PR to avoid sequence number collisions.

## Table Locking

Never write a migration that locks an entire table. Common operations that acquire table-level locks:

- `ALTER COLUMN` (type change) — rewrites the table
- `CREATE INDEX` without `CONCURRENTLY`
- `ADD FOREIGN KEY` without `NOT VALID`
- `LOCK TABLE`

## Column Type Changes

As noted above, `ALTER COLUMN` (type change) rewrites the entire table and blocks concurrent DML: strongly avoid. A real-world example took 8+ hours on a large customer database. When unavoidable, use a multi-release phased approach:

1. Release N: add the new column.
2. Release N+1: backfill data via background jobs; use triggers for ongoing updates.
3. Release N+2 (ESR): start using the new column in code.
4. Release N+3 (ESR): drop the old column.

## Batch Updates

Never do a full-table `UPDATE` in a migration. Process data in batches in a job at runtime:

```sql
UPDATE foo SET col = value
WHERE id IN (
  SELECT id FROM foo WHERE id > :offset ORDER BY id ASC LIMIT 100
);
```

Store the offset and resume across job runs.

## Adding Unique Constraints

Do not add a unique constraint directly. Create the index concurrently first, then attach it:

```sql
CREATE UNIQUE INDEX CONCURRENTLY constraint_name ON foo (bar);
ALTER TABLE foo ADD UNIQUE USING INDEX constraint_name;
```

Note that this cannot be done inside a transaction block, so it must be in a separate migration file. Use the `-- morph:nontransactional` comment to disable transactions for that migration.

## Foreign Key Constraints

Avoid foreign key constraints. Adding a foreign key takes a `SHARE ROW EXCLUSIVE` lock, limiting concurrent activity to SELECT queries only. If truly needed, consider adding the constraint with `NOT VALID` to avoid the full-table scan under lock.
