# Workstreams

Status: **DRAFT**. Owners are suggestions; confirm in the team channel.

## Definition and policy

- **Goal:** Ratify the ZDT-App definition and SLOs, the N-1 compatibility contract, the breaking-change register, and rollback policy (binary-only).
- **First task:** Draft the one-page ZDT-App definition with the measurable criteria, circulate it for edits, and list the policy questions that need decisions (mixed-version window, rollback; ESR skip is settled: not allowed).
- **Suggested owner:** Reliability (Alejandro)
- **Agent-friendly:** Yes. Agents can draft, cross-check against the blocker register, and keep the register current.

## Migration safety

- **Goal:** Make schema migrations provably expand-only and short-lock, with a lint, lock_timeout and per-migration observability.
- **First task:** Audit migrations 000150-000234 against the extended rule set, producing a table of statements that would fail it (000217, 000216, 000195, 000223, 000152 first). Spec the lint rules.
- **Suggested owner:** Server dev
- **Agent-friendly:** Yes. An agent can run the audit and prototype the linter.

## Mixed-version HA harness and load probe

- **Goal:** Build T01 and T02: a multi-node N-1 to N rolling upgrade under load, plus T03/T04.
- **First task:** Prototype a 3-node harness from docker-compose.yaml, or by extending the Playwright upgrade harness (single server today; the testing team lists multi-node as not covered yet), running one node swap with a 1s probe. Record the baseline.
- **Suggested owner:** Testing (Saturn)
- **Agent-friendly:** Yes. Compose files, probe scripts and CI wiring.

## Cluster, config and cache compatibility

- **Goal:** Close B40 through B52 and B47: version gate, leader policy, config push safety, Redis keying, event classification.
- **First task:** Write the mixed-version config test (T11) and the ClusterEvent compatibility table (T13). Verify the config overwrite hypothesis.
- **Suggested owner:** Server dev
- **Agent-friendly:** Yes for the audits and tests. Design decisions need review.

## Lifecycle: readiness and shutdown

- **Goal:** Provide a readiness endpoint, a configurable grace period for in-flight requests and ordered shutdown. Optional: websocket close frames and a clean cluster leave.
- **First task:** Spec /ready states (starting, migrating, ready, not-ready on shutdown) and the shutdown reorder. Measure current time-to-ready with logs.
- **Suggested owner:** Server dev
- **Agent-friendly:** Yes for the spec and tests (T16).

## DB connectivity and failover

- **Goal:** Make a writer failover recoverable without manual action, and fix the replica defects.
- **First task:** Build the failover rig (T07: kill, demote, DNS flip, blackhole) and record the current behavior. Unit-test the GetInternalReplicaDB panic.
- **Suggested owner:** SRE with Server dev
- **Agent-friendly:** Partly. The rig needs SRE, while agents can write the tests and fixes.

## Postgres version and upgrade plan

- **Goal:** Define the supported PG matrix per ESR and an online PG major upgrade path (ZDT-DB).
- **First task:** Reconcile the PG minimums (code, docs, ESR table), then plan the T09 matrix with the mirrored images. Interview Connor's customers on their methods.
- **Suggested owner:** SRE (Andre/Nuno)
- **Agent-friendly:** Partly. Agents can reconcile docs and set up CI matrix jobs.

## Plugins and integrations

- **Goal:** Define the plugin skew policy and compat matrix. Audit the prepackaged plugins' migrations.
- **First task:** For each prepackaged plugin, list its migration mechanism and whether N and N+1 can share a DB (B91). Run the T15 plugin-install-mid-roll test.
- **Suggested owner:** Server dev
- **Agent-friendly:** Yes for the audit across plugin repos.

## Search and jobs

- **Goal:** Make jobs version-aware and recoverable. Make search backfills gated. Define the search degradation behavior.
- **First task:** Spec the stale-job reaper and job version stamp. Run kill -9 tests on message export (T14).
- **Suggested owner:** Server dev
- **Agent-friendly:** Yes.

## ESR cadence, support window and CI matrix

- **Goal:** Settle the ESR support window proposal (current suggestion: 18 months instead of 12, supported by Amy) and make the upgrade matrix explicit, pinned and nightly. Define what ESR-to-ESR upgrade testing looks like (Amy: to be defined during this effort). Note that the existing upgrade tests upgrade from each supported minor and in-support ESR directly to the build under test, chosen by the support policy rather than by consecutive ESR pair.
- **First task:** Model the CI cost of the 18-month window (more ESRs in support at once) and an explicit matrix covering every consecutive ESR pair (no skip-one jobs: ESR skipping is not allowed). Decide whether an empty or unfetchable matrix should fail instead of reporting a green status.
- **Suggested owner:** Release (Amy) with Testing
- **Agent-friendly:** Yes for the model and CI changes.

## Customer architecture intake and certification

- **Goal:** Turn Connor's customer data into the certified-topology list and the architecture matrix.
- **First task:** Send Connor the question list above (failover, proxy, PG upgrade method, config model, load balancer, definition of zero downtime (ZDT)). Fill in the matrix as answers arrive.
- **Suggested owner:** Support (Connor)
- **Agent-friendly:** Partly. Agents can structure the intake and update the matrix.
