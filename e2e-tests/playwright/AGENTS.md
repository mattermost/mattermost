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

Each lesson below caused a real master E2E failure or a rejected fix. It binds
humans and agents alike, including the E2E Autofix automation, which cites the
ids in its PRs. Lessons marked _(lint)_ are also checked by
`npm run lint:lessons` on the files a change touches (see "Lint ratchet"); the
rest are enforced by review.

- **L-001** Locators live only in the page and component objects in `lib`. A
  spec never builds one (`page.locator`, `getByRole`, `getByTestId`,
  `frameLocator`, ...): add or reuse a page-object member. _(lint, report
  only for now: `lessons/no-spec-locators` under `specs/`)_ (#39372, review by
  saturninoabril)
- **L-002** No XPath. Use `getByRole` with an accessible name, then label or
  text, and `getByTestId` last; CSS class chains only when none of these work.
  _(lint: `lessons/no-xpath`; CSS chains by review)_ (#39372, review by
  saturninoabril)
- **L-003** When the cause is in the product, fix or report the product. Never
  work around it in the test, not even until the product is fixed. The usual
  workaround is `force: true`: if an element won't take a click, find what
  intercepts it. _(lint: `playwright/no-force-option`)_ (#39372: matthewbirtch's
  review traced a forced click to a global `label span { pointer-events: none }`
  in `_mobile.scss`)
- **L-004** When several specs share a defect, fix it once in a shared helper
  in `lib` and use it in every spec that has it, failing yet or not. (#38986)
- **L-005** A product fix that needs new goroutines, timeouts, locks or APIs is
  not a small fix to bundle with a test change. Report it to the owning PR.
  (#39376: the reviewer reverted the added timeouts)
- **L-006** Each test restores only the settings in
  `getOnPremServerConfigPatch()` (`lib/src/server/default_config.ts`, applied
  by `resetConfigWith`). Every other setting a spec changes through
  `/api/v4/config`, and every piece of data it leaves behind, reaches later
  specs on the same server. `MM_*` environment variables are different: the
  fixture resets them before each spec file (`ensureDefaultServerEnv`, see
  above), so they never belong in the patch. When a setting leaks, add it to
  that patch, and add every other setting earlier specs change that the patch
  misses, not only the one that failed today. Data has no reset: a spec that
  depends on what exists (teams, policies, user counts) creates or reads that
  state itself. Leaks fixed so far: `CollapsedThreads` (#39377),
  `PrivacySettings.ShowFullName`/`ShowEmailAddress` (#39497), open-invite teams
  (#39864). In review: `ElasticsearchSettings.Enable*` (#39871), leftover ABAC
  policies (#39875).
- **L-007** No `waitForTimeout`. `isVisible()` doesn't wait and ignores its
  `timeout`, so never swallow it (`isVisible().catch(...)`), assert on it
  (`expect(await locator.isVisible()).toBe(...)`) or branch on it
  (`if (await locator.isVisible())`). Use web-first assertions
  (`toBeVisible()`, `toBeHidden()`, `toHaveText()`), and for an optional
  element wait for the state that decides whether it shows. Lines you edit
  follow this even if they broke it before. _(lint:
  `playwright/no-wait-for-timeout`, `playwright/prefer-web-first-assertions`,
  `lessons/no-unwaited-is-visible`; the last catches `isVisible().catch(...)`
  and `isVisible()` used directly in an if, ternary or loop condition, with
  `await`, `!`, `&&`/`||` or `===`/`!==`, but not a result stored in a
  variable first, which review enforces)_ (#39372)
- **L-008** A fix shows a failing run before and a passing run after. A
  server-log signal alone justifies a report, not a fix. The exception is a
  small product fix whose new unit test fails before and passes after.
  (#39376)
- **L-009** A server that silently degrades (a fallback, a swallowed error) is
  a product bug to report, not a wait to add to the test. (Counter-example:
  #39445 made the search specs wait for an engine answer because search
  silently falls back to Postgres on engine errors.)

### Playwright rules

Enforced by review:

- Call `check()` and `uncheck()` directly, with no read-then-act guard
  (`if (!(await x.isChecked()))`).
- `waitForResponse`: create the promise before the action and await both
  together (`Promise.all([page.waitForResponse(...), action])`).
- Bodies of `expect.poll` and `expect(...).toPass` must be idempotent: no
  posting, creating or patching inside them.
- No non-null assertions (`!`) on results; assert they exist with `expect`.
- No `.first()` or `.nth()` unless order is what the test checks.

### Lint ratchet

The _(lint)_ rules live in `eslint-rules/lessons.mjs`. Many existing files
break them, so they are not part of `npm run lint`. Instead,
`npm run lint:lessons` (`script/lint-lessons-ratchet.mjs`, also run by
`npm run check` and in CI) lints every `.ts` file your change touches twice,
as it is now and as it was on the base, and fails if any lesson rule fires
more often now. Files you don't touch are never checked.

- When it fails, it lists every hit of that rule in the file, old and new.
  Remove the one you added; you don't have to fix the old ones.
- Rules in `REPORT_ONLY_RULES` (`eslint-rules/lessons.mjs`) are listed the
  same way but don't fail yet. L-001 starts there; it becomes blocking once
  page objects cover the common cases and the team is told.
- Renaming or moving a file compares it with its old path, so a pure move
  passes.
- The base is the merge base of `HEAD` and `origin/master`. Set `LESSONS_BASE`
  to compare against another commit; CI sets it to the PR's base.
- The rules are best-effort pattern checks. They don't see through variables
  or constants (`const visible = await x.isVisible(); if (visible)`, or
  `locator(SELECTOR)` where `SELECTOR` is a constant), so those forms still
  break the lessons and are enforced by review.

### Adding a lesson

Add a lesson when a human review rejects the same mistake in two or more PRs,
or when it caused a master failure. Give it the next id, one rule in a
sentence or two, and the PRs that taught it. If a lint rule can catch it, add
it to `lessonsConfig` in `eslint-rules/lessons.mjs` (a new rule in that file,
or a `playwright/` rule) in the same PR. A rule that many open PRs would
break can start in `REPORT_ONLY_RULES`. When a lesson's rule has no
violations left anywhere, move it into `eslint.config.mjs` as a plain error.
The E2E Autofix weekly retrospective opens such PRs from reviewer feedback; a
human merging the PR is what makes the lesson binding.

### Updating or retiring a lesson

A lesson with no recent violations is working: keep it. Change one only when
its premise changed:

- **Update** it when a file, helper or setting it names was renamed or moved.
- **Retire** it when what it guards against can no longer happen: the helper,
  API or behaviour is gone, or a lint rule or type now makes the mistake
  impossible and the lesson says nothing the rule's message doesn't.
- **Merge** two lessons that say the same thing into the older id.

Delete a retired lesson in the same PR that explains why, and never reuse its
id, because PRs cite them. Keep this list short enough to read before every
change: past 15 lessons, merge or retire before adding.
