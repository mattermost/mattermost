# Phase 5: Quality

**Goal**: Pass all linters, security checks, and quality gates.

## Step 5.1: Auto-fix
- Go: `make fmt`
- JS/TS: `npm run fix`
- If project has separate formatters (prettier, stylelint): run those too — `npm run format`

## Step 5.2: Lint & Type Check
- Run each lint/check command from the profile
- If errors remain after auto-fix: fix manually, re-run
- Max 2 fix attempts

## Step 5.3: Security & Dependency Audit
- **npm**: `npm audit --audit-level=moderate` — flag new vulnerabilities
- **Go**: `go list -m all` — check for known CVEs (use `nancy` or `trivy` if available)
- **New dependencies**: detect via `git diff` on `package.json` / `go.mod` — flag for review
- **License check**: verify new deps have compatible licenses (if `license-reviewer` agent available)
- **Supply chain verification**: For new dependencies, verify package name is canonical (not typosquatted — check npm registry or pkg.go.dev directly). Flag exact version pinning without justification. Check if the dependency is maintained (last publish date, open issues count).
- Non-blocking: report findings as warnings, don't gate on SHOULD_FIX

## Step 5.4: i18n
- **MM**: Run `make i18n-extract` if webapp strings changed
- **Playbooks**: Run `make i18n-extract` for both server and webapp

## Step 5.5: API Contract Validation (if API surface changed)
- Detect OpenAPI/Swagger spec files (`.yaml`, `.json` in `api/`, `docs/`, or root)
- If spec exists: validate syntax (`openapi-generator validate` or equivalent linter)
- Diff spec against previous version: flag breaking changes (removed endpoints, changed required fields, narrowed response types)
- If no spec file but new API endpoints were added: warn that OpenAPI spec should be updated
- Non-blocking: report as SHOULD_FIX
- **Auth consistency**: If new API endpoints were added, verify they have authentication/authorization consistent with existing endpoints (Bearer token, session auth, rate limiting). Flag unauthenticated public endpoints.

## Step 5.6: Database Migration Validation (if migrations detected)

**Reference**: Mattermost Schema Migration Guidelines (Agniva De Sarker, 2023). See also `/database-migrations:sql-migrations` command for general migration patterns. Guidelines inlined below.

**Three goals (non-negotiable)**:
1. Migrations ALWAYS backwards compatible to last ESR
2. Migrations NEVER lock the entire table
3. Reduce migration time where possible

## Operation Safety Matrix (PostgreSQL 11+)

| Operation | Table Rewrite | Concurrent DML | Safe? |
|-----------|--------------|----------------|-------|
| CREATE INDEX (CONCURRENTLY) | NO | YES | YES |
| DROP INDEX (CONCURRENTLY) | NO | YES | YES |
| ADD COLUMN (nullable) | NO | YES | YES |
| ADD COLUMN (non-null + default, pg11+) | NO | YES | YES |
| ALTER COLUMN type | YES | NO | AVOID — multi-ESR pattern required |
| DROP COLUMN | NO | YES (metadata only) | YES — but defer to ESR+2 |
| ADD FK CONSTRAINT | NO | SELECTs only | AVOID |
| ADD UNIQUE CONSTRAINT | NO | YES | YES (use CONCURRENTLY + USING INDEX) |

## Forbidden in a single release:
- **ALTER COLUMN type** — takes exclusive lock, can run 8+ hours on large tables. Use multi-ESR column replacement pattern instead.
- **FK constraints** — take SHARE ROW EXCLUSIVE lock in PG. Avoid entirely.
- **Unbatched UPDATE/DELETE** on large tables — must use batched operations with offset tracking.

## Multi-ESR Pattern (for breaking schema changes):
```text
ESR N (base):     read/write old column
ESR N+1:          add new column (nullable), dual-write old+new, start batch migration job
ESR N+2:          verify batch complete, switch reads to new column, stop writing old
ESR N+3:          drop old column
```
Backwards compatibility must be maintained to the previous ESR — customers upgrade ESR-to-ESR.

**Synchronization model**: The batch migration job runs AFTER dual-write is established in ESR N+1, in parallel with normal app traffic. The job must be **idempotent** — store the last-processed offset in a job metadata table (not state.json), so it can resume on crash without re-processing rows. During the backfill period, app code must use `COALESCE(new_col, old_col)` to handle NULLs from un-migrated rows.

**DROP COLUMN timing**: DROP COLUMN is metadata-only in PostgreSQL but MUST be deferred to ESR N+2 minimum. Never drop a column that the previous ESR's code still writes to — DOWN migration cannot safely restore it during rolling rollback.

## Safe Operations:
- **CREATE TABLE**: no locks on existing data
- **ADD COLUMN** (nullable or with default on pg11+): instant, metadata only
- **CREATE INDEX CONCURRENTLY**: no locks
- **DROP INDEX CONCURRENTLY**: no locks
- **DROP COLUMN**: metadata only in PG (space reclaimed by future writes)

## Data Migration Pattern (UPDATE/backfill):
- NEVER run unbounded UPDATE on entire table
- Use batched updates with offset tracking (stored in job metadata):
  ```sql
  UPDATE table SET new_col = ... WHERE id IN (
    SELECT id FROM table WHERE id > $offset ORDER BY id ASC LIMIT $batch_size
  );
  ```
- Run as async job after all cluster nodes upgraded
- Handle NULL-to-non-NULL via COALESCE in app code, not migration

## Unique Constraint Pattern (PostgreSQL):
```sql
-- Step 1: create index without locks
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table(col1, col2);
-- Step 2: attach to constraint (instantaneous)
ALTER TABLE table ADD UNIQUE USING INDEX idx_name;
```

## UP migration requirements:
- Additive only: new tables, new nullable columns, new indexes (CONCURRENTLY)
- No destructive ops in same release — multi-ESR pattern required
- No ALTER COLUMN type — ever, unless security-critical
- No FK constraints
- Batched backfills only (no unbounded UPDATE/DELETE)

## DOWN migration requirements:
- **Every UP must have a corresponding DOWN** that cleanly reverses the change
- DOWN must be safe to run while the newer version is still serving traffic (rolling rollback)
- DOWN must not drop data created by the new version unless explicitly documented
- Test: run DOWN, verify previous version's tests still pass

## Validation checklist:
- [ ] UP migration is additive (no table rewrites, no exclusive locks)
- [ ] DOWN migration exists and reverses the UP
- [ ] No ALTER COLUMN type (or multi-ESR plan documented)
- [ ] No FK constraints added
- [ ] Indexes use CONCURRENTLY (PostgreSQL)
- [ ] UPDATE/DELETE statements are batched with offset tracking
- [ ] Column additions are nullable (NOT NULL deferred to later ESR after backfill)
- [ ] Migration file naming follows project convention
- [ ] If breaking change: multi-ESR plan documented in implementation plan with ESR versions identified
- [ ] Backwards compatible to last ESR

**Blocking**: Migration violations are MUST_FIX — zero-downtime is non-negotiable.

**Gate**: All lint/type checks pass. Security findings reported (warnings, not blocking). Update state.json per [rules.md §1.5](rules.md#15-statejson-update-ritual).

Lint/type fix budget: 2 attempts ([rules.md §4](rules.md#4-retry--escalation-budgets)).

---
