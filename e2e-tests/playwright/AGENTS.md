# AGENTS.md

## Parallelism: 1 worker per server, many servers in parallel

Playwright runs with a single worker per server (`PW_WORKERS` defaults to `1`
in `lib/src/test_config.ts`): tests execute serially against any one server,
never concurrently, since many specs mutate shared server-wide state (feature
flags, config, licenses).

CI parallelizes across jobs instead: each job in the `workers` matrix
(`e2e-tests-playwright-template.yml`) boots its own Testcontainers server and
runs its own single-worker Playwright process (`dispatch-run`), pulling spec
files off a shared queue. The suite runs many servers in parallel, but always
one worker per server -- never multiple workers sharing one server.

Don't use `test.describe.configure({mode: 'parallel'})` or assume two tests in
different files could race: they never do within a job.

## `ensureFeatureFlag`: changes a flag on the running server, no restart

The server boots on its default feature flags, and a spec changes one only through
`pw.ensureFeatureFlag(flagName, value)` / `pw.ensureFeatureFlag({flagA: true,
flagB: false})` (`lib/src/server/feature_flags.ts`). Never set `MM_FEATUREFLAGS_*`
(including through `MM_ENV`): an env var wins over everything else and can't change
at runtime, so the harness drops it.

With the `splitmock` service (always started in Testcontainers mode, so it never needs listing in
`PW_TESTCONTAINERS_SERVICES`), the server syncs its flags from a
mock Split.io service (`lib/src/containers/assets/split-mock`) that
`ensureFeatureFlag` drives. The change reaches the running server within its sync
interval (`PW_FEATURE_FLAG_SYNC_INTERVAL_SECONDS`, 1s) and the server is **not**
restarted. In this mode a flag change that doesn't arrive, or a server that wasn't
booted to use the mock, fails the test instead of skipping it or restarting.

- Call it at the top of every test that needs it, inside the test body -- not
  from a bare top-level call or `test.beforeAll()`. `pw` is a test-scoped
  fixture (depends on per-test `page`/`context`) and isn't available in
  `beforeAll`.
- Tests in one file may ask for different values: flipping a flag is cheap, so
  there is no need to split files by flag combination. Before the first test of
  each spec file the fixture puts every flag back to its default
  (`ensureDefaultServerEnv`, no restart).
- `pw.defineFeatureFlags()`, `pw.setFeatureFlagSegments()` and
  `pw.getFeatureFlagKey()` model Split targeting (rules for chosen keys,
  segments, attributes, percentages). See `feature_flag_split_mock.spec.ts`.
- Against an external server (no Testcontainers) there is no mock, so
  `ensureFeatureFlag` can only skip the test when a flag has to change.

- Before the first test of each spec file, the test fixture restarts the server
  with the env a fresh boot gets (`ensureDefaultServerEnv`), dropping every
  `MM_*` var an earlier file set (`ensureMinio()`,
  `ensureOpensearch()`, ...), so a spec only sees what it requests itself. Don't
  rely on leftovers. Consecutive files that request the same non-default env each
  pay a restart to clear and set it.

This is enforced by review, not tooling.

## `ensurePhase2MigrationCompleted`: only for specs that use schemes

The server is ready once `/api/v4/system/ping` answers; the permissions migration
(`lib/src/server/migrations.ts`) is not waited for at boot. Scheme endpoints
(`createScheme`, `updateTeamScheme`, ...) return 501 until it finishes, so a spec
that calls them runs `await pw.ensurePhase2MigrationCompleted()` first. It starts
the migration through `mmctl --local` instead of waiting for the server's 60s
scheduler.

## Licensing

Use `await pw.skipIfNoLicense()` to skip a test when the server has no
license.
