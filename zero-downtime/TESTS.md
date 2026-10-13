# Test plan

Status: **DRAFT**. Test IDs are referenced from `BLOCKERS.md` and `README.md`.

| ID  | Name                                               | Owner      | Effort | Covers                       |
|-----|----------------------------------------------------|------------|--------|------------------------------|
| T01 | Availability probe harness                         | Testing    | M      | B140, B141                   |
| T02 | Mixed-version HA rolling upgrade under load        | Testing    | L      | B40, B43, B60, B61, B141     |
| T03 | Old-app/new-schema compatibility                   | Testing    | M      | B11, B16, B18, B19           |
| T04 | Rollback                                           | Testing    | M      | B21                          |
| T05 | Migration lock-time CI check                       | Testing    | M      | B12, B13, B15, B17, B142     |
| T06 | Extended migration linter plus INVALID-index check | Server dev | M      | B12, B20, B22                |
| T07 | Writer failover scenarios                          | SRE        | L      | B72, B73, B66, B14, B20      |
| T08 | Replica and lag scenarios                          | Testing    | M      | B74                          |
| T09 | Postgres major upgrade and version matrix          | SRE        | L      | B70, B71, B78                |
| T10 | Concurrent first start and migration chaos         | Testing    | M      | B14, B30, B31                |
| T11 | Config propagation across versions                 | Testing    | M      | B47, B36, B130               |
| T12 | Redis mixed-version and cross-talk                 | Testing    | M      | B45, B46                     |
| T13 | Cluster event and websocket contract tests         | Server dev | M      | B41, B42, B48                |
| T14 | Leader and jobs under a roll                       | Testing    | M      | B43, B110, B111, B112, B113  |
| T15 | Plugins in a mixed cluster                         | Testing    | L      | B90, B92, B93, B94, B95      |
| T16 | Readiness and shutdown                             | Testing    | M      | B60, B61, B62, B63, B64, B65 |
| T17 | ESR-to-ESR schema equivalence and skip guard       | Testing    | S      | B04, B143, B144              |
| T18 | Search backend upgrade                             | Testing    | M      | B100, B101, B102, B103       |
| T19 | Mixed-version data-shape tests                     | Server dev | M      | B16, B18, B19, B32, B33, B35 |
| T20 | Store suite behind a transaction-mode pooler       | Testing    | M      | B77                          |

## T01 - Availability probe harness

A reusable load and probe generator. 1s probes for login, read, post, file upload and websocket connect through the load balancer. It records error rate, latency, consecutive failures, websocket reconnects and event loss. It is a library for every other test.

**Pass criteria:** Emits the availability, mixed-version, websocket, latency and data integrity metrics per run.

## T02 - Mixed-version HA rolling upgrade under load

3 app nodes at N-1 behind nginx (start from the docker-compose.yaml HA layout, or extend the Playwright upgrade harness, which today runs a single server on a fixed port, swaps only the Mattermost container and keeps config in Postgres and files on a bind mount), one PG and optionally Redis. Roll the nodes one at a time (taken out of the load balancer, then a grace period before stopping), both with and without a prior optional 'db migrate' with N, and run T01 throughout. The version matrix comes from `resolve_upgrade_matrix.mjs`, which the Playwright upgrade tests already use.

**Pass criteria:** All criteria in README section 3.3, per from-version.

## T03 - Old-app/new-schema compatibility

Migrate with the N binary ('db migrate'), then run the N-1 (and N-2) API and functional smoke suite against it. The Playwright upgrade harness only moves from old to new, but its API-only seed and verify steps could be reused for this. Required gate on any PR adding a migration. Also check that the old binary boots against the newer schema.

**Pass criteria:** No failures beyond a documented allowlist.

## T04 - Rollback

After T02, swap one or more nodes back to N-1 with the schema left forward. A variant runs 'db downgrade' pre-traffic. Test with data created post-upgrade.

**Pass criteria:** The rollback criterion in README section 3.3. Documented data-loss cases enumerated.

## T05 - Migration lock-time CI check

Apply the PR's pending migrations to a seeded large dataset (millions of posts and members) while pgbench or HTTP load runs. Record pg_locks waits and the max lock-hold time.

**Pass criteria:** No lock held longer than 1-2s on hot tables. Failing DDL is flagged for review.

## T06 - Extended migration linter plus INVALID-index check

Squawk-style rules for ALTER TYPE, DROP/RENAME, NOT NULL without a default, constraints without NOT VALID, UPDATE without batching and matview drops. A post-migration indisvalid check.

**Pass criteria:** Lint blocks merge unless annotated.

## T07 - Writer failover scenarios

Under T01 load: (a) hard kill, (b) demotion with the old primary alive, (c) DNS flip, (d) iptables DROP blackhole. Test with and without pgbouncer and Patroni. Also a node starting during the outage, and a failover mid-migration.

**Pass criteria:** Time to first successful write per node. Whether recovery needs a manual recycle. Error count.

## T08 - Replica and lag scenarios

Kill and blackhole a replica. Inject lag (recovery_min_apply_delay). Start a node with a replica down and call GetInternalReplicaDB (the panic path).

**Pass criteria:** No panic. Bounded error rate. No read-after-write regressions.

## T09 - Postgres major upgrade and version matrix

Run the PG 14/15/16/17 matrix using the mirrored images. Test an N-1 app against PG N+1. Test an online PG major upgrade (logical replication or blue/green plus a proxy flip) with the app running, and check FTS config, collation and search after.

**Pass criteria:** Documented outage window. Search EXPLAIN uses the GIN index.

## T10 - Concurrent first start and migration chaos

Start 3 new nodes at once against a pending long migration. kill -STOP the migrator past the 15s TTL. Drop the DB connection mid-migration. Start two servers during app migrations.

**Pass criteria:** No concurrent migrators. No Fatal from a race. A clean retry.

## T11 - Config propagation across versions

A new node saves a config with a new field and enum value while an old node is live, under both DB and file config. Check that the shared row keeps the field. Check that config written by N Loads and passes IsValid in N-1.

**Pass criteria:** No settings lost. N-1 boots.

## T12 - Redis mixed-version and cross-talk

Share a Redis between N-1 and N with a changed msgp struct (simulated). Check the decode-error path (GetSession and ClearUserSessionCacheLocal). Run two ClusterNames on one Redis.

**Pass criteria:** Decode errors are handled as misses. No cross-delivery.

## T13 - Cluster event and websocket contract tests

Per-ClusterEvent payload compatibility between N and N-1. An unknown-event metric. Websocket broadcast filters fail closed on old nodes. Reconnect to another node while a peer is down.

**Pass criteria:** Each event is classified as tolerable or requires-uniform.

## T14 - Leader and jobs under a roll

Track leadership across each node bounce. Check cross-version job claiming. kill -9 mid message_export, mid batch migration and mid ES indexing. Verify the stale-job reaper once built. Test the dedicated job node topology.

**Pass criteria:** No job stuck in_progress. No duplicate scheduling.

## T15 - Plugins in a mixed cluster

Run Calls, Playbooks, Boards and Agents bundles at the current and previous version on different nodes sharing one DB. Install a plugin with a newer min_server_version mid-roll. Browse with a non-sticky load balancer and watch /static/plugins/* 404s. Run the plugin compat matrix (each plugin against server N, N+1, N-1).

**Pass criteria:** No plugin UI lost. No old-node plugin deleted.

## T16 - Readiness and shutdown

SIGTERM under load. Measure in-flight request failures, websocket reconnect time, time-to-ready (migrations, app migrations, plugins), ping semantics and Operator probe behavior. Also test SIGTERM during the startup window.

**Pass criteria:** Zero failed in-flight requests within the grace time. Reconnect within 15s.

## T17 - ESR-to-ESR schema equivalence and skip guard

Extend the Playwright upgrade harness (its matrix already covers in-support ESRs) so that, for every consecutive ESR pair, the upgraded database is diffed against a fresh install of the same version. Restoring real ESR dumps and reviving psql-migration-test.sh is an optional extra. Under the no-skip assumption, also check that an attempted ESR skip (N to N+2) is detected, with refusal or warning per the B04 decision.

**Pass criteria:** No schema drift on any consecutive ESR pair. Skip attempt is flagged.

## T18 - Search backend upgrade

ES 9 and OS 3 in CI. Start vN+1 then vN against one ES and diff the templates. Check DB fallback during an ES stop. Check live-index flush on SIGTERM.

**Pass criteria:** Search degraded-not-down. No template regressions.

## T19 - Mixed-version data-shape tests

Create rows with each new enum value on N and read them through N-1. PropertyOptions edits from N-1. ABAC view queries from N-1. ACP v0.3 evaluation on N-1. CPA linked-field options on N-1. An admin role edit on N-1.

**Pass criteria:** Documented behavior, with no 500s.

## T20 - Store suite behind a transaction-mode pooler

Run the full store test suite plus an e2e smoke behind pgbouncer (transaction mode) and RDS Proxy. A lint forbidding session-level SQL features.

**Pass criteria:** Green on both.
