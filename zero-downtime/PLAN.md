# Plan

Goal: get real measurements fast. Most blockers are `unknown` until something runs.

## Active workstreams

| Workstream | Goal | Owner |
|---|---|---|
| Definition and policy | Ratify the ZDT-App definition, rollback policy, mixed-version window (README section 5). | Alejandro |
| Mixed-version harness | Build T01, T02, T03: a multi-node N-1 to N roll under load. | Saturn (Testing) |
| Migration safety | Make migrations expand-only and short-lock: lint, `lock_timeout`, metrics. | Server dev |
| Readiness and shutdown | `/ready` endpoint, configurable grace period, ordered shutdown. | Server dev |

Parked until data arrives: ZDT-DB (failover, Postgres upgrade), cluster/config compatibility, plugins, search and jobs, ESR cadence and CI matrix, customer intake.

## Next steps

**Days 1-2**
1. Verify B11 by hand: `db migrate` with the new binary, then boot the old binary. Does it start and serve the API?
2. Spike a 2-node roll from `docker-compose.yaml` / `make run-haserver`. Put a 1s probe (login, read, post) through nginx. Swap node A, then node B, with and without a prior `db migrate`. Record error windows, time-to-ready, websocket behavior. Throwaway prototype of T01/T02.
3. Re-verify the Tier 1 blockers with agents, one per blocker, read-only. Each ends `verified` or `refuted`, with corrected line numbers.

**Days 3-5**
4. 30-minute decision review. Three yes/no items: ZDT-App / ZDT-DB split, binary-only rollback, 2h mixed window.
5. Send the asks below to Connor and SRE.
6. Open Jira/GitHub issues for verified Tier 1 blockers only. This folder stays a summary.

**Week 2**
7. Saturn turns the spike into T01/T02 on the Playwright/Testcontainers harness.
8. Spec `/ready` and the grace period (B60, B61).
9. Run the migration audit (000150-000234) against the lock-safety rules. Start with 000217, 000216, 000195, 000223, 000152.

## First tests

| ID | Test | Covers |
|---|---|---|
| T01 | **Availability probe.** 1s probes for login, read, post, upload and websocket through the load balancer. Records errors, latency, consecutive failures, reconnects, lost events. Reused by every other test. | B140, B141 |
| T02 | **Mixed-version rolling upgrade under load.** 3 nodes at N-1 behind nginx, one PG. Roll one at a time (out of the load balancer, grace period, stop), with and without a prior `db migrate`. Run T01 throughout. Pass: README section 2 criteria. | B40, B60, B61, B141 |
| T03 | **Old app on new schema.** Migrate with N, then run the N-1 API and smoke suite. Also check that the old binary boots. Gate for any PR adding a migration. Pass: no failures beyond an allowlist. | B11, B16, B18, B19 |
| T16 | **Readiness and shutdown.** SIGTERM under load. Measure failed in-flight requests, reconnect time, time-to-ready, SIGTERM during startup. Pass: zero failed in-flight requests within grace, reconnect within 15s. | B60, B61, B64, B65 |
| T05 | **Migration lock time.** Apply pending migrations to a large seeded dataset under load. Record lock waits and hold time. Pass: no lock over 1-2s on hot tables. | B13, B15, B17, B142 |

## Test backlog

Most reuse the T01/T02 harness, so write them after it exists.

| ID | Test | Covers |
|---|---|---|
| T04 | Rollback: swap nodes back to N-1, schema forward | B21 |
| T06 | Migration linter plus invalid-index check | B12, B20, B22 |
| T07 | Writer failover (kill, demote, DNS flip, blackhole) | B72, B73 |
| T08 | Replica kill and lag | B74 |
| T09 | Postgres major upgrade and version matrix | B70, B71, B78 |
| T10 | Concurrent first start and migration chaos | B14, B30, B31 |
| T11 | Config propagation across versions (DB and file config) | B36, B47, B130 |
| T12 | Redis mixed version and cross-talk | B45, B46 |
| T13 | Cluster event and websocket contract tests | B41, B42, B48 |
| T14 | Leader and jobs under a roll, kill mid-job | B43, B110-B113 |
| T15 | Plugins in a mixed cluster | B90-B95 |
| T17 | ESR-to-ESR schema equivalence and skip guard | B04, B143, B144 |
| T18 | Search backend upgrade | B100-B103 |
| T19 | Mixed-version data-shape tests | B16, B18, B19, B32, B33, B35 |
| T20 | Store suite behind a transaction-mode pooler | B77 |

## Asks

**Connor (Support)**
1. Which failover and proxy do the interested customers run (Patroni/VIP, RDS/Aurora, pgbouncer, RDS Proxy, pgProxy, blue/green)?
2. How do they upgrade Postgres, and which majors do they run? How many are on PG 14 (EOL 2026-11-12)?
3. DB-backed or file config? Redis in HA? Read replicas?
4. Load balancer health-check settings and stickiness.
5. What does "zero downtime" mean to each: tolerated error window, reduced capacity, read-only mode? Do any skip ESRs today?

**Andre / Nuno (SRE)**
1. What do the Operator and Cloud provisioner really do on a roll (strategy, surge, probes, grace period, preflight `db migrate`)?
2. Is there Cloud availability data during upgrades we can use as a baseline? Any existing upgrade-under-load or failover tests?

**Saturn (Testing)**
1. Can the Testcontainers stack run multiple app nodes plus a proxy? Is anyone scheduled for multi-node upgrade tests (roadmap item 5)?
2. Where does the load generator live (mattermost-load-test-ng)? Can it provide T01?

**Amy (Release)**
1. Is 18-month ESR support decided? What is the CI cost?
2. Can the release gate include T02, T03 and T17?

Other open questions (engineering code checks, release process details) are in the git history of `QUESTIONS.md`.
