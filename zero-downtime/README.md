# Zero-downtime upgrades

- **Owners:** Alejandro (Reliability, pilot), Andre/Nuno (SRE)
- **Also involved:** Connor (Support), Saturn (Testing), Amy (Release)
- **Status:** DRAFT v0, 2026-10-13. Everything here is a proposal, not a decision.
- **Files:** `README.md` (definition, decisions), `REGISTER.md` (blockers by tier), `PLAN.md` (next steps, tests, asks), `BLOCKERS.md` (evidence per blocker), `AGENTS.md` (agent rules).

## 1. Why

Large customers expect something different from what we deliver as "zero-downtime upgrade". We need to define the guarantee, find what blocks it, pick the architectures we certify, and assign owners.

From the Barcelona meeting:

- Customers need about 6 months to certify an ESR, which is longer than our overlap. Amy (Release) supports 18 months of ESR support instead of 12.
- We guarantee nothing explicit today.
- Customers accept reduced capacity if the system stays up.
- DB migrations and Postgres upgrades both cause downtime, and are separate problems.
- No automated tests cover old app on new DB, or HA.
- We aim for no breaking changes ESR to ESR. Skipping an ESR is unsupported.
- Customer architectures (blue-green, pgProxy) and behavior on writer loss are unknown.

## 2. Proposed definition

Two layers fail in different ways, so we define them separately.

- **ZDT-App:** upgrade the nodes of an HA cluster one at a time while users keep working.
- **ZDT-DB:** survive Postgres events (writer failover, major upgrade).

**Recommendation:** promise ZDT-App now. Treat ZDT-DB as a separate, weaker track.

Why: Mattermost does not recover from a writer failover on its own, and the documented Postgres upgrade stops Mattermost. One combined promise would be false.

### Statement

> When a licensed HA cluster is upgraded from release N to N+1 using the documented procedure, users keep working the whole time: API, login, posting, files and websockets stay available. At most one node is out at a time, and no one stops all nodes. Operators may run the schema migration as a separate step before the roll. Allowed side effects: websocket reconnects, search served from the database, stateless plugin restarts, delayed background jobs.

**Taking a node out of service** needs two things: (1) it stops getting new requests before it stops, and (2) it waits a configurable grace period for in-flight requests. Moving websockets and leaving the cluster cleanly are optional, because clients reconnect in about 3-5s.

**In scope**
- HA cluster (licensed, `ClusterName` set), 2 or more nodes behind a load balancer.
- One Postgres writer, no major version change during the window.
- Shared filestore. DB-backed or identical file config.
- ESR to next ESR, and patch/minor upgrades in the CI matrix.
- Procedure: optional `mattermost db migrate`, then rolling restart, then check `/api/v4/cluster/status`. Without the pre-step, the first upgraded node migrates at boot.
- Rollback means binary only, with the schema left forward.

**Out of scope**
- Single node (call it "minimal downtime"; the listener opens only after migrations and plugins).
- Skipping an ESR.
- Postgres major upgrade and writer failover (ZDT-DB).
- Elasticsearch/OpenSearch upgrades (degraded, not down).
- Plugin installs and admin config changes mid-roll. Active Calls sessions.
- Blue/green with two app fleets on one DB, until customer data shows a need.
- Breaking changes outside ESR boundaries. They go in a breaking-change register.

### Criteria (targets to calibrate, no baseline yet)

| Area | Target |
|---|---|
| Availability | At least 99.9% of requests succeed over the window. 1s probes. Max 5s of consecutive failed probes. |
| Mixed version | N-1 and N both pass smoke and API suites while running together. Window of 2h or less. |
| Websocket | At least 99% of clients reconnect within 15s. No event loss, or a client resync. |
| Latency / capacity | p95 within 2x baseline. At least N-1 nodes serving at all times. |
| Schema | No DDL holds a lock over 1-2s on hot tables (posts, channelmembers, threadmemberships, users, sessions). Data-proportional work runs as batch jobs. |
| Data | No lost or duplicated acknowledged posts or files. No reverted settings. |
| Rollback | A node swapped back to N-1 on the migrated schema meets the criteria above. |
| Readiness | Time-to-ready is measured. Grace period is at least the load balancer deregistration time. |
| Jobs | None stuck `in_progress` after a node stop. Message export not blocked. |

## 3. What the code gives us today

- **Exists:** migration lock, cluster leave plus gossip drain, search fallback to the DB, Playwright upgrade tests (single server, last 3 minors plus in-support ESRs).
- **Missing:** readiness signal, configurable grace period (hard-coded 1s today), optional migrate-before-roll step, N-1/new-schema tests, mixed-version HA harness, migration lock-safety lint, cluster version gate.

Answers to the meeting questions, from code only:
- **Writer goes down?** No retry beyond serialization/deadlock errors. Stale connections can last up to 1h. Startup gives up after about 60s.
- **Old app on newer DB?** Not enforced or tested.
- **Customer architectures?** pgbouncer-style proxies look plausible but are untested.

## 4. Topologies

| Topology | Target |
|---|---|
| HA (gossip), 2+ nodes, one PG writer, DB config, shared filestore | **Primary certification (ZDT-App)** |
| HA + Redis | Candidate. Open: msgp cache decode errors across versions. |
| HA + read replicas | Candidate, needs replica fixes (B74). |
| HA + pgbouncer / RDS Proxy / pgProxy | Unknown. Needs customer data. |
| Kubernetes (Operator/Helm) and Cloud | Candidate and baseline. Tooling is outside our repos; ask SRE. |
| Single node | Not ZDT ("minimal downtime") |
| Blue/green app fleets on one DB | Not certified |
| Managed PG failover, blue/green DB, PG major upgrade | ZDT-DB track |
| External search upgrade | Degraded, not down |

## 5. Decisions needed

1. Ratify the ZDT-App / ZDT-DB split and the strictness level.
2. Rollback policy: binary only, schema forward (B21).
3. Mixed-version window (2h or less?).
4. Config model to certify: DB-backed or file (B130).
5. ESR support window and cadence (18 months?), and PG minimum-version notice period (B02, B03, B71).
6. Which topologies to certify. Blocked on Connor's data.

**Decided (working assumption):** ESR to ESR is required and no ESR can be skipped. So only consecutive ESR pairs are certified and tested, skips should be detected and refused or warned (B04), and breaking changes can land at ESR boundaries.

## 6. Provenance

- Generated 2026-10-13 by agents reading the server and enterprise repos. Nobody has *run* the cross-version scenarios, so `unknown` means "needs a test".
- Not verified (from docs): release-policy dates, the v12.0 removal list, Operator and Cloud behavior.
- Plugin sources are not in these repos. Plugin findings cover the server side only.
- Testing facts come from the testing team's announcement, PR #38367 and the "Rolling Upgrade Tests: Technical Specification".
