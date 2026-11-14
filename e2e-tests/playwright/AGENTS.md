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

- Before the first test of each spec file, the test fixture restarts the server
  with the env a fresh boot gets (`ensureDefaultServerEnv`), dropping every
  `MM_*` var an earlier file set (feature flags, `ensureMinio()`,
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

## Lessons from master failures

These rules bind humans and agents; PRs cite their ids. Rules marked _(lint)_
are also checked by `npm run lint:lessons` on the files you change. Where each
lesson came from, how the check works, and how lessons are added or retired:
`docs/lessons.md`.

- **L-001** Specs never build locators (`page.locator`, `getByRole`,
  `getByTestId`, ...): add or reuse a member of a page or component object in
  `lib`. _(lint, report-only for now)_
- **L-002** No XPath. In page objects prefer `getByRole` with an accessible
  name, then label or text, then `getByTestId`; CSS class chains only when
  nothing else works. _(lint)_
- **L-003** Fix or report a product bug; never work around it in the test, for
  example with `force: true`. Find what intercepts the click. _(lint)_
- **L-004** Fix a defect that several specs share once, in a shared helper in
  `lib`, and use it in every spec that has it.
- **L-005** A product fix that needs new goroutines, timeouts, locks or APIs is
  not small: report it to the owning PR instead of bundling it with a test
  change.
- **L-006** Each test restores only `getOnPremServerConfigPatch()`
  (`lib/src/server/default_config.ts`). A config setting a spec changes that
  isn't in it leaks into later specs: add it there, with every other setting
  earlier specs change that it misses. `MM_*` env is reset per spec file
  (`ensureDefaultServerEnv`) and never belongs in the patch. Data (teams,
  policies, users) has no reset: a spec creates or reads the state it needs.
- **L-007** No `waitForTimeout`. `isVisible()` doesn't wait: don't `.catch()`
  it, assert on its result or branch on it. Use web-first assertions
  (`toBeVisible()`, `toBeHidden()`); for an optional element, wait for the
  state that decides whether it shows. _(lint, except a result stored in a
  variable first)_
- **L-008** A fix shows a failing run before and a passing run after. A
  server-log signal alone earns a report, not a fix, unless it is a small
  product fix whose new unit test fails before and passes after.
- **L-009** A server that silently degrades (a fallback, a swallowed error) is
  a product bug to report, not something for the test to wait out.

Playwright rules, enforced by review:

- Call `check()` and `uncheck()` directly, with no read-then-act guard.
- `waitForResponse`: create the promise before the action and await both with
  `Promise.all`.
- `expect.poll` and `toPass` bodies are idempotent: no creating, posting or
  patching inside them.
- No non-null assertions (`!`) on results; assert they exist with `expect`.
- No `.first()` or `.nth()` unless order is what the test checks.
