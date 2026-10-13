# Open questions

Status: **DRAFT**. Check off as answered and record the answer inline.


## Connor (Support / customer data)

- [ ] Which failover and PG mechanism do the customers interested in zero downtime (ZDT) run (Patroni or VIP, RDS or Aurora DNS flip, pgbouncer, RDS Proxy, pgProxy, blue/green)? This decides B72, B77 and the architecture matrix.
- [ ] Which Postgres upgrade method do they use (pg_upgrade, logical replication, RDS blue/green)? Which majors do they run today? How many are on PG 14, given the v12.0 release on 2026-10-14 and the PG 14 EOL on 2026-11-12?
- [ ] Do they use DB-backed config or per-node config.json? Is Redis in HA, and which version? Which read replicas?
- [ ] What load balancer behavior and health-check parameters do they use (path, interval, thresholds, deep ping, stickiness, websocket handling)? Who runs blue/green, and on which Redis?
- [ ] What does 'zero downtime' mean to each customer: the error window they tolerate, whether reduced capacity is fine, and whether a read-only degraded mode is acceptable? What are their certification steps (the 6-month process), and do any of them actually skip ESRs today (we assume ESR-to-ESR is required and skipping is not allowed), and would that assumption be a problem for them?
- [ ] Which plugins, Calls with rtcd, IdPs, S3-compatible stores, ES or OS versions and pgvector features are in use? Do they customize load balancer stickiness?
- [ ] How many tickets exist for upgrade-related outages, and what caused them?

## Andre / Nuno (SRE)

- [ ] What do the Operator and the Cloud provisioner really do: strategy, maxSurge and maxUnavailable, readiness probe, terminationGracePeriod, whether the preflight 'db migrate' job always runs, Redis sharing? Can Cloud's measured availability during upgrades serve as a baseline?
- [ ] Does the Cloud or SRE tooling already run upgrade-under-load, HA or failover tests (including mattermost-load-test-ng)?
- [ ] How are PG major upgrades done on Cloud today? Can the SRE team build the PG failover and pgbouncer test rigs (T07, T09, T20)?
- [ ] What are the actual load balancer health-check parameters on Cloud, and does anything use get_server_status=true?
- [ ] What SIGTERM grace period is used in practice (Helm, Operator, Cloud)? It determines how often stuck jobs and cut-off requests occur.
- [ ] Which Postgres connection-limit and sizing guidance do you recommend for a rolling window?

## Saturn (Testing)

- [ ] Multi-node and mixed-version upgrades are listed as not covered yet (roadmap item 5 of the upgrade tests' spec). Is anyone scheduled to build them, and can the Testcontainers stack (single server, fixed port, only the Mattermost container swapped) be extended to multiple app nodes plus a proxy (T02)?
- [ ] Answered: the upgrade-from-* statuses are not a required check, but a triggered run must pass, and the verified-label and override workflows find them by name pattern. Still open: which suites run in the weekly and nightly workflows that the skeptics did not read?
- [ ] Where does the load generator live (mattermost-load-test-ng)? Can it provide T01?
- [ ] The upgrade tests run Postgres only and cost one run per from-version times 20 workers, each with a 60-minute budget. Can T17 reuse them (schema comparison against a fresh install) instead of restoring ESR dumps? What is the budget for a PG 14-17 matrix and an ES 9 and OS 3 job?
- [ ] You said asserting migration time (for example under 1 minute) is on your radar. What environment and dataset preconditions would make it deterministic, and could that feed T05?
- [ ] Do enterprise workflows (ci.yml, server-test-template.yml) run any HA or multi-PG coverage that the name-based grep missed?

## Amy (Release)

- [ ] Is the ESR lineage authoritative (v11.7 now, v12.4 planned 2027-02-16)? Who owns the releases table that CI parses? Is v12.0 an ESR?
- [ ] Can the release process carry a breaking-change register, a migration-compatibility checklist and an enterprise-pin check (B120)?
- [ ] Amy supports extending ESR support from 12 to 18 months. Is this decided, and what is the CI cost impact (more ESRs in support at once)? What does the ESR-to-ESR upgrade testing look like (she suggests defining it in this effort)? How should the PG minimum bump be announced one ESR ahead?
- [ ] Do patch releases ever change prepackaged plugin versions mid-ESR (Makefile pins, FIPS pin)?
- [ ] Can the release gate include T02, T03 and T17 results?
- [ ] How should the docs claim for ESR-to-ESR (which says 'supported and tested') and the PG-version wording (14+ versus 15) be reconciled?

## Engineering (verify in code)

- [ ] Verify the morph guard: does an old binary really boot against a newer schema? (B11)
- [ ] Do new-version nodes still read PropertyFields.Attrs->'options', and were the ABAC views redefined after 000216? (B16, B18)
- [ ] Does the lib/pq version in use produce 25006 stale-connection errors in a failover? Does a reset or EOF on first use return driver.ErrBadConn and get retried transparently? (B72)
- [ ] Do structs in Session, User and TeamMember change between ESRs? (B45)
- [ ] How do old nodes treat ACP v0.3 data and CPA linked fields? (B32, B33)
- [ ] What are the measured ACCESS EXCLUSIVE hold time of 000217 and the build time of 000234 on a large dataset? Do the m2 app migrations take long on large data?
- [ ] Does the ES bulk processor flush on Stop? Does the admin 'Index now' purge first?
- [ ] Which leader-gated tasks and jobs are safe on an older binary? Which other per-node goroutine 'jobs' (like compliance) lack leader gating? Are role-cache invalidations after permission migrations broadcast?
- [ ] Does /api/v4/system/ping answer during startup? Is it effectively unreachable until the listener opens?
- [ ] Does any enterprise code (license, compliance, ldap) refuse or warn on version skew? Is the memberlist protocol stable across releases?
- [ ] Is HA allowed without database-backed or shared config? Does the cluster behave sanely on license expiry or loss mid-upgrade (B51)?
- [ ] Missed items to track: the Redis-first broadcast order versus gossip-only RPCs, ConfigChanged failures logged only at Debug, the ConfigurationWillBeSaved hook running on pushed configs, the plugin enable state arriving through shared config before the plugin exists on a node, plugin health-check permanent deactivation, startup versus shutdown of the local-mode and HTTPS-redirect listeners, and the migration statement timeout versus the 15s lock-TTL interaction.
