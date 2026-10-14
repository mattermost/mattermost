# Blocker register

One line per blocker, sorted by tier. Evidence and remediation are in `BLOCKERS.md` under the same ID. IDs are stable; never renumber.

- **Tier 1:** breaks the ZDT-App promise. Verify first, then fix.
- **Tier 2:** degrades the upgrade. Document or fix after Tier 1.
- **Tier 3:** parked. ZDT-DB or external. Revisit when customer data arrives.

Status: `open` -> `verified` -> `in-progress` -> `done`, or `refuted`. All items are `open` (nobody has run them yet).

## Tier 1 - breaks the promise

| ID | Claim | Owner | Status |
|---|---|---|---|
| B01 | No written definition or N-1 compatibility contract. ESR-to-ESR is prose only. | Reliability | open |
| B10 | Every node migrates at boot. No supported migrate-before-roll. Old nodes serve while DDL runs. | Server | open |
| B11 | Old binary on the new schema is neither enforced nor tested. | Testing | open |
| B13 | No `lock_timeout`. DDL waiting for a lock blocks all queries on the table. | Server | open |
| B15 | Migration 000217 locks `posts` and drops the search index until 000234 rebuilds it. | Server | open |
| B17 | Big backfills run in single-transaction migrations, unbatched. | Server | open |
| B40 | No version check when nodes join a cluster. | Server | open |
| B47 | Config pushed between versions can overwrite the shared config and lose new fields. | Server | open |
| B60 | No readiness signal. `/system/ping` returns 200 until the socket closes. | Server | open |
| B61 | Shutdown grace is a hard-coded 1s, then in-flight requests are cut. | Server | open |
| B64 | Startup is serial and unbounded: migrations, app migrations, plugins, then listen. | Server | open |
| B111 | A killed node leaves jobs `in_progress` forever. Message export can silently stop. | Server | open |
| B141 | No multi-node or mixed-version HA test in CI. | Testing | open |

## Tier 2 - degrades

### Policy and release

| ID | Claim | Owner | Status |
|---|---|---|---|
| B02 | ESR overlap (12 months) is shorter than customer certification (6 months of testing). | Release | open |
| B03 | v12.0 removals and the PG minimum bump fall inside the guaranteed ESR span. | Release | open |
| B04 | Skipping an ESR is silently possible. No guard or telemetry. | Server | open |
| B05 | Docs claim rolling and uninterrupted upgrades with no definition or test. | Support | open |
| B21 | Rollback is manual and lossy. Many down migrations are `SELECT 1` or lose data. | Reliability | open |

### Migrations

| ID | Claim | Owner | Status |
|---|---|---|---|
| B12 | Migration lint only covers `CREATE/DROP INDEX CONCURRENTLY`. | Server | open |
| B14 | Migration lock is a 15s-TTL row. A failed refresh goes unnoticed. | Server | open |
| B16 | Migration 000216 drops the ABAC view, so N-1 queries may fail. | Server | open |
| B18 | Property options moved tables with no dual-write. N-1 writes are likely ignored. | Server | open |
| B19 | New enum values (channel type, property field type, permission level) are unknown to N-1. | Testing | open |
| B20 | An interrupted `CREATE INDEX CONCURRENTLY` leaves an invalid index nobody checks. | Server | open |
| B22 | Drop/rename steps rely on convention. Nothing stops dropping too early. | Server | open |
| B30 | App-level migrations run before listen and `Fatal` on any error. | Server | open |
| B31 | App migrations have no cluster lock. Two starting nodes can race. | Server | open |
| B32 | Access-control policy v0.2 to v0.3 rewrite runs in place. N-1 behavior unknown. | Server | open |
| B33 | CPA to Global Attributes migration changes data shape. | Server | open |
| B34 | Property-group migrations from an older node can rewrite newer definitions. | Server | open |
| B35 | New built-in permissions are unknown to N-1. Admin role edits may fail. | Server | open |
| B36 | The first node of a new version rewrites shared config with its defaults. | Server | open |

### Cluster and config

| ID | Claim | Owner | Status |
|---|---|---|---|
| B41 | Old nodes only log unknown cluster events, so cache invalidations are dropped. | Server | open |
| B42 | Gossip RPCs fail the whole admin call on the first peer error. | Server | open |
| B43 | Leader is the smallest random ID, not version-aware. It flaps on every join/leave. | Server | open |
| B44 | Batch-migration gate compares schema version only and counts stale discovery rows. | Server | open |
| B45 | Redis msgp caches (Session, User, TeamMember) have no versioning. | Server | open |
| B46 | Redis pub/sub channel is a fixed name, so clusters sharing Redis cross-talk. | Server | open |
| B48 | Websocket forward-compat is by convention only. | Server | open |
| B49 | Mixed versions always look like config drift. | Server | open |
| B50 | Cluster discovery can fail to heartbeat. Stale rows are cleaned only at start. | Server | open |
| B51 | A node that fails to load its license silently runs unclustered. | Server | open |
| B52 | Memberlist and compression compatibility across releases is unverified. | Testing | open |
| B68 | No config watcher. Many settings need a restart, so a change is a rolling restart. | Server | open |
| B130 | Certified config model (DB vs file) is undecided. | Reliability | open |

### Lifecycle

| ID | Claim | Owner | Status |
|---|---|---|---|
| B62 | Websockets drop with no close frame. Resume buffer is per node. | Server | open |
| B63 | Every node start resets all users offline in the shared DB. | Server | open |
| B65 | SIGTERM during startup exits without leaving the cluster. | Server | open |
| B66 | Deep ping writes to the DB. A DB blip ejects every node at once. | SRE | open |
| B67 | Webapp assets are per node. A non-sticky load balancer across versions can 404 chunks. | Server | open |

### Plugins and search (degraded, not down)

| ID | Claim | Owner | Status |
|---|---|---|---|
| B90 | Prepackaged plugin upgrades are per node. Old and new plugin builds share data during the roll. | Testing | open |
| B91 | Plugin-owned migrations are unaudited (plugin sources are elsewhere). | Server | open |
| B92 | A cluster plugin-install message deletes the working plugin before the version check. | Server | open |
| B93 | Plugin bundle hash differs per node, so clients may load a bundle another node cannot serve. | Server | open |
| B94 | Plugin ABI has no cross-version test. | Testing | open |
| B95 | Plugin restarts lose in-memory state. Health check can permanently deactivate a plugin. | Server | open |
| B100 | Every node overwrites the ES/OS index templates at start. | Server | open |
| B101 | No zero-downtime reindex path. | Server | open |
| B102 | Search backfill is a per-node goroutine. Live indexing may lose data on stop. | Server | open |
| B103 | ES/OS version checks are log-only. CI lacks ES 9 and OS 3. | Testing | open |

### Jobs

| ID | Claim | Owner | Status |
|---|---|---|---|
| B110 | Jobs carry no version. Any node claims any pending job it knows. | Server | open |
| B112 | A worker's `Stop` blocks until the job ends. A short grace leads to SIGKILL, then B111. | Server | open |
| B113 | Daily compliance export is per node with no leader gating. | Server | open |
| B114 | Retention, LDAP sync and export are cancelled on stop, not resumed. | Server | open |
| B115 | Jobs depend on the DB writer. Failures are mostly only logged. | Testing | open |

### Testing

| ID | Claim | Owner | Status |
|---|---|---|---|
| B140 | The Playwright "rolling upgrade" tests swap one server. They do not measure availability. | Testing | open |
| B142 | No test of DB behavior during migration (locks, large data). | Testing | open |
| B143 | Upgrade matrix is selective and an empty matrix reports green. | Testing | open |
| B144 | No schema drift check (upgraded vs fresh install). | Testing | open |

## Tier 3 - parked (ZDT-DB and external)

| ID | Claim | Owner | Status |
|---|---|---|---|
| B70 | Postgres major upgrade stops Mattermost. No tooling or runbook. | SRE | open |
| B71 | PG minimum: code says 15, docs say 14+. CI uses 15 only. | Release | open |
| B72 | No writer-failover handling. Stale connections can last up to 1h. | Server | open |
| B73 | Query timeout does not bound a black-holed writer. | SRE | open |
| B74 | Replica defects: leaks, a panic path, narrow offline detection. | Server | open |
| B75 | Startup gives up after about 60s if the DB is down. | SRE | open |
| B76 | Connection budget multiplies during a roll. | SRE | open |
| B77 | pgbouncer / RDS Proxy compatibility looks plausible but is untested. | Testing | open |
| B78 | After a PG host move, FTS config and collation may degrade search. | SRE | open |
| B120 | Enterprise pins the server at a pseudo-version. Lock-step releases needed. | Release | open |
| B121 | External dependencies have no declared version ranges. | Support | open |
| B145 | No rollback, chaos or failover tests in the repos. | SRE | open |
