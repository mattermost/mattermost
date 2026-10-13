# Zero-downtime upgrades - working document

- Owners:
  - Alejandro (Reliability, pilot)
  - Andre/Nuno (SRE)
- Also involved:
  - Connor (Support)
  - Saturn (Testing)
  - Amy (Release)
- Status: **DRAFT v0 - 2026-10-13.**
  - Seeded from an agent-assisted read of `mattermost/server` and the enterprise repo.
  - Everything here is a proposal to be challenged, not a decision.

## 1. Why this exists

Several large customers understand "zero-downtime (ZDT) upgrade" differently from what we deliver. We need to:

- define what we guarantee,
- find what blocks that guarantee,
- decide which architectures we certify,
- assign owners.

Source notes: the Barcelona meeting (see [the channel's first post](https://hub.mattermost.com/private-core/pl/hdrn16z653b7z81p5rkbrp91ha)).

Team scope from the meeting:

- describe the problems,
- define the zero-downtime policy,
- define certified architectures,
- define the Postgres version-update plan,
- define ESR cadence and support window,
- find owners.

## 2. Notes from the meeting

- ESR window too short (some customers need 6 months of certification). Proposal: same ESR cadence, longer support window. Update (Amy, Release): the suggestion is to support ESRs for 18 months instead of 12, and she is supportive. She also proposes defining the ESR-to-ESR upgrade testing as part of this effort.
- No clarity on what we guarantee.
- Customers may accept reduced capacity if the system stays up.
- DB migrations and Postgres version updates both cause downtime; they are independent issues.
- No automated tests for older app vs newer DB, or for HA.
- Today we aim for zero downtime and no breaking changes ESR -> ESR; skipping an ESR is accepted as unsupported for zero-downtime. We will introduce breaking changes and cannot wait two years to do it.
- Customer architectures unknown (blue-green, pgProxy). Behavior on DB writer loss unknown.

## 3. Proposed definition

Upgrading Mattermost touches two layers that fail in different ways, so we propose defining zero-downtime separately for each:

- **ZDT-App** covers the Mattermost servers: upgrading the nodes of an HA cluster one at a time while users keep working. The main work here is schema migrations, taking nodes out of service cleanly and keeping the old and new versions compatible while both run.
- **ZDT-DB** covers the database: Postgres events such as a writer failover or a Postgres major version upgrade. These can interrupt Mattermost even when the application upgrade itself goes cleanly.

**Recommendation:** promise ZDT-App (the statement in 3.2), and treat ZDT-DB as a separate track that starts with a weaker promise.

Why: today the database tier cannot meet the ZDT-App promise. Mattermost does not recover from a writer failover on its own, and a Postgres major upgrade means stopping Mattermost. Putting both in one promise would make it false. The meeting notes already treat migrations and Postgres upgrades as independent issues.

### 3.1 Why this level of strictness

- Customers may accept reduced capacity as long as the system stays up and reachable (meeting notes). So the promise is that at least one node is always serving and nothing stops entirely, not that nothing changes at all.
- Anything stricter is not achievable today. Surviving a writer failover or a Postgres major upgrade with no outage is out of reach: there is no connection-error retry beyond serialization and deadlock errors (SQLSTATE 40001/40P01), and the documented Postgres upgrade procedure stops Mattermost. Plugin state (for example active Calls sessions) is lost when a plugin restarts. These belong to ZDT-DB and to later work.
- Anything weaker would not match what customers expect from the term, for example upgrades that need all nodes stopped, or that give no way to take a node out of the load balancer before stopping it.
- ZDT-DB starts with a weaker promise: the cluster stays up as a whole, with a bounded window of write errors during a failover. The longer-term goal is no outage beyond reconnects.

**What the code supports today for ZDT-App**

- Exists: the Morph migration lock (serializes concurrent migrators), cluster leave plus gossip drain, search falling back to the database, and Playwright upgrade tests (single server, from the last 3 minors and in-support ESRs, run when migrations change and at every release cut).
- Missing: a readiness signal, so the load balancer can stop sending traffic to a node before it stops, and a configurable grace period for in-flight requests (today it is a hard-coded 1s), a supported (optional) migrate-before-roll step, N-1/new-schema tests, a mixed-version HA test harness, a migration lock-safety lint, a cluster version gate and a tested mixed-version window.
- Single-node installs cannot meet it, because the listener opens only after migrations and plugin activation.

### 3.2 Recommended statement

> When a licensed HA cluster is upgraded from release N to N+1 using the documented procedure, users can keep working the whole time: API, login, posting, file access and websockets stay available. At most one node is out of service at a time, and nobody has to stop all nodes. Operators who want more control can optionally run the schema migration as a separate step before rolling the nodes. The only allowed side effects are websocket reconnects, search served from the database, stateless plugin restarts and delayed background jobs.

**Taking a node out of service.** A sudden node death is already something an HA cluster must survive, so this only reduces errors during planned restarts. Two behaviors are required:

1. The node stops receiving new requests before it stops (a readiness signal or load balancer deregistration).
2. It waits a configurable grace period for in-flight requests to finish.

Moving WebSocket clients and leaving the cluster cleanly are optional improvements: clients already reconnect in about 3-5s and peers detect a dead node through gossip.

**In scope:**

- HA cluster (licensed, `ClusterName` set), >=2 app nodes behind a load balancer.
- Single PG writer whose major version does not change during the window.
- Shared filestore.
- DB-backed or identical file config.
- ESR->next ESR and patch/minor upgrades within the CI matrix.
- Procedure: optional pre-flight `mattermost db migrate` (for customers who want control over when the schema changes) -> rolling restart (see "Taking a node out of service" below) -> convergence check via `/api/v4/cluster/status`. Without the pre-flight step, the first upgraded node runs the migration at boot.
- Rollback = binary-only, schema left forward.

**Out of scope:**

- Single-node (call it "minimal downtime").
- Skipping an ESR (assumed not allowed: customers must upgrade ESR to ESR, see decision 4).
- PG major upgrade and writer failover (ZDT-DB).
- Elasticsearch/OpenSearch upgrades (degraded-not-down).
- Plugin install/upgrade and admin config changes mid-roll.
- Active Calls sessions.
- Blue/green with two app fleets on one DB (until customer data shows need).
- Breaking changes: runtime-affecting removals may land only at ESR boundaries and must be listed in a breaking-change register.

### 3.3 Proposed measurable criteria (targets to calibrate - no baseline exists yet)

- **Availability at the load balancer**: >=99.9% of requests succeed over the window; probes at 1s; max consecutive failed probe time 5s.
- **Mixed-version**: N-1 and N both pass a smoke + API suite while coexisting; mixed window <=2h in the supported procedure.
- **Websocket**: >=99% of clients reconnect within 15s of a node going out of service; no event loss or a client resync is triggered.
- **Latency**: p95 within 2x baseline; capacity >= N-1 nodes at all times.
- **Schema**: no DDL holds a lock >1-2s on hot tables (posts, channelmembers, threadmemberships, users, sessions); data-proportional work runs only as batch jobs gated on cluster uniformity.
- **Data integrity**: no lost/duplicated acknowledged posts or files; no reverted settings.
- **Rollback**: swapping a node back to N-1 against the migrated schema passes the criteria above.
- **Readiness**: time-to-ready (migrations, app migrations, plugin activation) measured and reported; the grace period is at least the load balancer deregistration time.
- **Jobs**: none left stuck `in_progress` after a node stop; message export not blocked.

## 4. Key findings (details in `BLOCKERS.md`)

Main blockers (verified or high-confidence):

- **No definition/contract.** ESR->ESR guarantee is prose only, not enforced in code (B01).
- **Every node auto-migrates at boot**; no supported migrate-before-roll; old nodes serve while DDL lands (B10).
- **N-1 against new schema is neither enforced nor tested** (B11).
- **No cluster version-compatibility gate**; version, schema and config hash are advertised but unused (B40).
- **No readiness signal**; `/system/ping` returns 200 until the socket closes (B60). **Shutdown has a hard-coded 1s grace** (B61).
- **PG major upgrade is its own downtime event** - documented procedure stops Mattermost (B70). **No runtime writer-failover handling** (B72).
- **No multi-node/mixed-version HA test in CI.** The existing Playwright rolling upgrade tests upgrade one server by stop-and-replace and check that the server starts and data survives (B140, B141).

Notable `unknown`/`degrades` themes: migrations without `lock_timeout` and with unbatched backfills on hot tables (B13, 15, 17); storage moves without dual-write (PropertyFields options, B16/18); app-level migrations running synchronously before the listener opens, with `Fatal` on error (B30); config pushed across versions can overwrite shared config (B47); Redis msgp tuple cache without versioning (B45); jobs unversioned and stuck after SIGKILL (B110/111); prepackaged plugin migrations unaudited (B91); PG minimum inconsistency (code 15 vs docs 14+, B71).

**Answers to meeting questions, as far as code shows:**

- *DB writer goes down?* No retry beyond serialization/deadlock errors; pooled connections to a demoted primary can persist up to 1h; startup gives up after ~60s (B72/75; test T07).
- *Older app vs newer DB?* Nothing enforces or tests it (B11; test T03).
- *Customer architectures?* Static review suggests pgbouncer-style proxies are plausible but untested (B77; T20).

## 5. Contents of this folder

| File               | Purpose                                                                  |
|--------------------|--------------------------------------------------------------------------|
| `BLOCKERS.md`      | 81 candidate blockers with evidence, remediation, owner, effort, status. |
| `TESTS.md`         | 20 proposed tests (T01-T20) mapped to blockers.                          |
| `ARCHITECTURES.md` | Topologies to (not) certify, known/unknown.                              |
| `WORKSTREAMS.md`   | 11 workstreams, first tasks, suggested owners.                           |
| `QUESTIONS.md`     | Open questions per person/team.                                          |
| `AGENTS.md`        | How to use agents on this document.                                      |

## 6. Decisions needed (first pass)

1. Ratify the ZDT-App / ZDT-DB split and the level of strictness (section 3).
2. Certified config model for rolling upgrades: DB-backed vs file (B130).
3. Rollback policy: binary-only with schema forward? (B21)
4. Mixed-version window. DECIDED (working assumption): ESR-to-ESR upgrades are required and customers cannot skip any ESR. Consequences: the ESR-to-ESR path is the only certified upgrade path; skipping is out of the guarantee and, ideally, should be detected and refused or warned about (B04); the CI matrix needs no skip-one jobs, but every consecutive ESR pair must be covered (T17, and the ESR cadence workstream); breaking changes may land at ESR boundaries without a skip-compatibility burden.
5. ESR support window and cadence; Postgres minimum-version announcement lead time (B02, 03, 71). Input from Amy (Release): extending ESR support from 12 to 18 months was suggested and she supports it (keeps the cadence, addresses the 6-month customer certification). Still to settle: CI cost of the longer window, and what ESR-to-ESR upgrade testing looks like (to be defined during this effort, see the ESR cadence workstream and T02/T17).
6. Which topologies to certify (blocked on Connor's data; `ARCHITECTURES.md`).

## 7. Caveats on provenance

- Generated 2026-10-13 by agents reading both repos, each area followed by a skeptic pass; refuted and corrected items were dropped or amended. Nobody has *run* the cross-version scenarios - treat `unknown` as "needs a test".
- **Not verified** (derived from docs, treat as unconfirmed): release-policy dates and the 9-month cadence / 12-month support, the v12.0 removal list, Kubernetes Operator behavior, Cloud provisioner behavior. Operator and Cloud tooling are not in either repo.
- Testing-coverage facts were updated on 2026-10-13 from the testing team's announcement of the Playwright rolling upgrade tests (and its thread), the pull request that introduced them, and the "Rolling Upgrade Tests: Technical Specification".
- Plugin sources (Calls, Playbooks, Boards, Agents) are not in these repos; plugin findings are about the server side only.
- Corrected during verification: up-migrations number 232 files (to 000234, with gaps); `ClusterGracefulDrain` defaults to true but is gossip-only and skipped with Redis; websocket reconnect ~3s + up to 2s jitter.
- Elasticsearch/OpenSearch code lives in the monorepo (`server/enterprise/elasticsearch`), not in the enterprise repo.
