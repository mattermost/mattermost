# Impact Gate execution comparison

`impact-gate-compare.mjs` compares the current attempt's advisory plans with public TSIO report/evidence/orchestration responses and GitHub's exact-attempt jobs API. It runs from the trusted workflow checkout after the E2E jobs. It never checks out or executes the tested revision, runs tests, creates statuses, retries failed tests, or changes the full-suite dispatch.

Run with Node 22; no package installation or runtime dependency is needed:

```sh
node .github/scripts/impact-gate-compare.mjs
```

| Environment | Meaning |
| --- | --- |
| `IMPACT_GATE_PLANS` | Downloaded artifact directory containing `<suite>.json` plans and `provenance.json` |
| `IMPACT_GATE_CONFIG` | `examples/mattermost/advisory.config.json` in the separately checked-out pinned planner repository |
| `IMPACT_GATE_PLANNER_SHA` | Full planner commit; must equal that repository's HEAD |
| `TESTED_SHA`, `BASE_SHA` | Frozen source and requested comparison-base commits; Git objects must already be fetched |
| `GITHUB_REPOSITORY` | `mattermost/mattermost` |
| `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT` | Exact current GitHub run and attempt |
| `GITHUB_SHA` | Workflow-event SHA; binds trusted checkout, artifact provenance, and worker `head_sha`, separately from `TESTED_SHA` |
| `TSIO_URL` | HTTPS API base ending in `/api/v1`, selected to match the existing report producers |
| `GH_TOKEN` | Read-only GitHub Actions token; sent only to `https://api.github.com` |
| `COMPARISON_OUTPUT` | Local output directory |
| `GITHUB_STEP_SUMMARY` | Optional local summary file to append |

The trusted planning step stamps this sidecar after producing the plans:

```json
{
  "planner_sha": "FULL_PLANNER_SHA",
  "repository": "mattermost/mattermost",
  "tested_sha": "FULL_TESTED_SHA",
  "base_sha": "FULL_REQUESTED_BASE_SHA",
  "workflow_sha": "FULL_WORKFLOW_SHA",
  "run_id": "RUN_ID",
  "run_attempt": "RUN_ATTEMPT",
  "plans": [
    {"file": "cypress-full-enterprise.json", "suite": "cypress-full-enterprise", "sha256": "FULL_FILE_SHA256"},
    {"file": "playwright-full-enterprise.json", "suite": "playwright-full-enterprise", "sha256": "FULL_FILE_SHA256"}
  ]
}
```

Both enterprise plans are required; include both FIPS plans when FIPS dispatch is enabled. A suite with actual worker jobs cannot be omitted from the artifact. Supported identities and worker names are tied to the reviewed reusable workflows: 40 Cypress workers and 20 Playwright workers, numbered exactly from 1, with `e2e-{framework}[-fips] / {framework}-full / dispatch-run-N` names. A topology change requires updating this caller's contract. Report counts alone never define the expected workers.

The caller checks sidecar identities and exact plan bytes, pinned configuration bytes, source/merge-base identities, the full NUL-delimited Git diff, suite/project/browser/edition fields, committed regular-file paths, static inventory, and selection membership. Multiple merge bases are rejected. Git source is read through `ls-tree` and `cat-file`; worktree PR code is never imported. The current pilot requires `mappings: []`; it does not authenticate mapping review or enable targeted dispatch. Nonempty diffs and empty inventories require full fallback selecting the entire static inventory. Supported inventory patterns use `*`, `**`, `?`, and bounded brace alternatives, including dot paths; unsupported patterns fail explicitly.

GitHub requests use `/actions/runs/{id}/attempts/{attempt}/jobs` with complete bounded pagination. The overall workflow may still be in progress while this summary job runs, but expected workers must be terminal. TSIO requests use `/tests/evidence`, `/reports/{group_id}`, and `/orchestration/status`; all receive the exact repository/tested-SHA/run/attempt/suite identity. Requests are GET-only, HTTPS, forbid redirects, time out after 20 seconds, and cap each response at 32 MiB. GitHub pagination is limited to 20 pages of 100 jobs. No credentials are sent to TSIO.

`comparison.json` distinguishes static selected files, registered queue units, actual dispatched specs with worker attempts, skipped/terminal units, worker membership, terminal failed specs, and retry survivors. Pending units with no attempts are not counted as actually dispatched. Numeric observed failed-spec selection recall requires complete untruncated evidence, exact worker/report membership, complete terminal units, and a valid terminal attempt with test-level failed outcomes. The terminal attempt must match `outcome_set_at`; expired, late, missing, or ambiguous final evidence cannot establish the denominator. A cluster representative may be another test and is never required to identify every cluster member. Stable-key history aggregates do not contribute to the denominator.

Complete report evidence also constrains orchestration completeness: every reported failure-member title must appear in reported attempt test cases for exactly one dispatched spec. Earlier attempts, including failures later healed by a retry, participate in this consistency check. Missing titles or titles shared across different specs make recall unavailable; the caller does not infer file identity from stable keys or cluster representatives. This cross-check cannot add failures to the denominator, which continues to use only final orchestration outcomes.

Playwright's producer preserves each in-process test retry as a separate row within the spec attempt. The comparison uses the last retry for each consistent title in that spec/project, requiring unique contiguous integer retry counters starting at zero. Raw rows remain intact for the report-member consistency check. Missing/duplicate counters, conflicting identities, a failed final retry in a passed unit, or a skipped retry after a failure keep the evidence unavailable. Cypress already emits summarized test outcomes and does not use this normalization.

Incomplete evidence retains validated observations in `observed_counts`, but recall's `included`, `missed`, `total`, and `rate` are all null. A complete run with no final failed specs has a zero denominator and null rate. Identity, configuration, or unsafe-path failures produce unavailable results without numeric observations. Retry survivors are separately reported and excluded from the final-failure denominator. Project/edition checks use report-group metadata; browser builds and per-test runtime environment are not verified. Behavioral coverage, causal accuracy, confirmed regressions, release safety, and time savings remain unavailable.

Outputs are `comparison.json`, `summary.md`, and original successful API response bytes under `evidence/`. Receipts record request URLs, retrieval times, byte counts, and SHA-256; input hashes bind the configuration, artifact sidecar, and plans. Unavailable comparisons exit zero and explain why in the artifact; inability to create/write the local output exits nonzero. The caller is advisory and the workflow keeps it outside E2E dispatch dependencies.

Validation:

```sh
node --test .github/scripts/impact-gate-compare.test.mjs
node .github/scripts/impact-gate-compare-replay.mjs \
  --artifacts /path/to/saved/artifacts/mattermost \
  --checkout /path/to/git-repository-with-tested-objects \
  --config /path/to/original/pinned/advisory.config.json
```

The replay reads the original `pr-38356` and `live-34174643457` evidence packs, verifies their saved response hashes, and exercises the same comparison function. It explicitly annotates the old retrospective plan's missing `sourceRunId` in memory; the runtime ingestion path never makes that substitution. Stored replay is not a new E2E run or live verification of the newly wired workflow.
