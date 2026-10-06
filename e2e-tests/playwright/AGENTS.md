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

## `ensureFeatureFlag`: one server restart per spec file

`pw.ensureFeatureFlag(flagName, value)` / `pw.ensureFeatureFlag({flagA: true,
flagB: false})` (`lib/src/server/feature_flags.ts`) restarts the Testcontainers
server with the given `MM_FEATUREFLAGS_*` env vars when it isn't already
running with them. Feature flags can't be changed via `patchConfig` on a
running server, so a restart is the only way to flip one.

- Call it at the top of every test that needs it, inside the test body -- not
  from a bare top-level call or `test.beforeAll()`. `pw` is a test-scoped
  fixture (depends on per-test `page`/`context`) and isn't available in
  `beforeAll`.
- Every test in a spec file must request the same flag combination. When the
  server already matches, this is a no-op, so a file restarts at most once, on
  its first test. Mixing combinations causes a restart on every change.
- A test needing a different combination belongs in its own file. See
  `specs/functional/channels/categories/managed_categories_flag_off.spec.ts`
  and
  `specs/functional/system_console/global_attributes/global_attributes_listing_classification_markings.spec.ts`.

This is enforced by review, not tooling.

## Licensing

Use `await pw.skipIfNoLicense()` to skip a test when the server has no
license.
