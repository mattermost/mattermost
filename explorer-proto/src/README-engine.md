# Explorer engine

Run from the repository root after `explorer-proto/infra/scripts/up.sh`. Node 24 runs the CLI directly (type stripping); Playwright, the browser and the TypeScript loader come from `e2e-tests/playwright/node_modules` through the git-ignored symlink `explorer-proto/node_modules -> ../e2e-tests/playwright/node_modules` (create it once with `ln -s ../e2e-tests/playwright/node_modules explorer-proto/node_modules`).

```bash
node explorer-proto/src/cli.ts explore      [--out=<dir>]   # bounded BFS -> <dir>/trace.json, trace.md
node explorer-proto/src/cli.ts emit         [--out=<dir>]   # trace.json + scenarios.json -> <dir>/*.spec.ts, trace.md
node explorer-proto/src/cli.ts replay       [--out=<dir>]   # runs the already-generated specs only (no explore/emit)
node explorer-proto/src/cli.ts guard-check  [--out=<dir>]   # network guard proof -> <dir>/guard-report.md
node explorer-proto/src/cli.ts guard-race   [--out=<dir>]   # teardown race regression (local server, no stack) -> <dir>/guard-race-report.md
node explorer-proto/src/cli.ts probe-absence [--out=<dir>]  # absence-locator non-vacuity -> <dir>/absence-probe-<variant>.md
```

- `<dir>` defaults to `explorer-proto/generated`. Arguments after `--` go to `playwright test` (e.g. `-- --grep PILOT-02`).
- `PW_BASE_URL` is optional; default is `base_url` from `infra/.run/seed-manifest.json`. It must be `http://127.0.0.1:<port>`.
- `PW_USE_TESTCONTAINERS` must be unset. The CLI drops `MM_LICENSE` from the Playwright process env.
- Exit codes: Playwright's for explore/replay/guard-check; emit exits 1 if any scenario was stopped.
- Reports: `generated/reports/<mode>.json` (Playwright JSON) and `generated/test-results/<mode>/`, both git-ignored. Screenshots, video and traces are off.

## How it works

- `playwright.config.ts` spreads `e2e-tests/playwright/playwright.config.ts`, keeps only the `chrome` project, skips the repo globalSetup, and selects the test dir by `EXPLORER_MODE` (`explore` and `guard-check` run `src/*.pw.ts`; `replay` runs `<dir>/*.spec.ts`).
- `session.ts` `openGuardedSession(pw)` calls the framework's `TestBrowser.login(seeded user)` on a Browser wrapper (`guard.ts` `guardedBrowser`). The wrapper creates the context with `serviceWorkers: 'block'` and installs the guard before returning it, so the guard exists before `login()` opens its page; `login()` never navigates.
- `guard.ts` allows exactly the manifest origin: `context.route('**/*')` aborts other origins, resolves 3xx responses itself (`route.fetch({maxRedirects: 0})`, every later hop checked) because Playwright does not route redirect hops, `context.routeWebSocket` closes WebSockets to any other origin, and a response/redirect-chain listener records escapes as violations that fail the session.
- Handler lifecycle: every route handler promise is tracked. Closing a session marks the ledger `closing`, refuses new fulfils (abort, counted as `teardown_aborted`), waits for in-flight handlers (bounded 2 s), closes, then lets late handlers settle. A handler error is benign only while closing and only for `Fetch response has been disposed`, `Request context disposed`, `Target page, context or browser has been closed` or `Route is already handled`; any other handler error is a violation that fails `closeGuardedSession(s)`.
- `explore.pw.ts`: roots and allowlist come from `scenarios.json`; every candidate action runs in a fresh guarded context that replays the path from the root. State key = pathname + normalized aria snapshot (`snapshot.ts`).
- `absence_probe.pw.ts`: on the `no-archive` seed every declared absence locator must find its element (Unarchive needs `manage_team`, which qa-user lacks, so the probe reports it as not shown present; its exact name is exercised by the coordinator's verify control with qa-user as team admin); on an archived seed each must find nothing.
- `emit.ts`: actions and locators come from the trace; assertions come only from `scenarios.json` `expected_outcome`, checked against the observed snapshots (a disagreement stops the scenario). Matrix rows marked COVERED in `coverage.md` are skipped.

## Charter sessions

```bash
explorer-proto/infra/scripts/up.sh --session=bookmarks
node explorer-proto/src/cli.ts explore --session=bookmarks [--out=<dir>]   # charter BFS -> <dir>/trace.json, trace.md
node explorer-proto/src/cli.ts emit    --session=bookmarks [--out=<dir>]   # trace + charter predicates -> <dir>/<dedupe key>.spec.ts
node explorer-proto/src/cli.ts replay  --session=bookmarks [--out=<dir>]   # runs that dir's spec only; PASS needs >=1 passed, 0 failed/skipped/flaky
```

- `<dir>` defaults to `sessions/<name>/generated`, outside `generated/`, so the pilot replay never picks the session spec up. `--session` sets `PILOT_SESSION` for the Playwright process; the config then runs `explore_session.pw.ts` for `explore`, uses the session dir as the replay `testDir`, and writes reports to the git-ignored `sessions/<name>/generated/{reports,test-results}`. Without `--session` (the CLI also drops an inherited `PILOT_SESSION`) every command and path is unchanged.
- **Inputs, all from `sessions/<name>/charter.json`:** `start.start_path` (single root), `allowed_actions` (an unordered set: exact entries only, sorted by role then name), `budget` (used as given), `expected_outcome`, `locator_scope.live_name_status` (its single-quoted substrings select the names to report) and `dedupe.key`. `src/` holds no route, click order, link name or expected string.
- **Exploration** reuses the pilot BFS (`bfs.ts`, shared with `explore.pw.ts`): fresh guarded context per candidate with path replay, state key = pathname + normalized snapshot, dedupe, volatile-text scrub, posts dropped. Session extras: the run's origin is replaced by `<origin>` before normalization; a marker set on `window` after the start navigation records whether each click kept the same document (no reload); every state records the live names of nodes whose role is a declared role expectation and whose name contains a reported substring. `trace.md` holds the sanitized action log (considered, skipped with reasons, taken, resulting path, state, diff, live names). Writing refuses output that contains a loopback host, the origin, the port, a seeded id or the seeded password.
- **Predicate evaluation** (`charter.ts`): a state is in a predicate's scope when its pathname equals the predicate's `url_path` (which must equal the `URL path equals …` path in `applies_to`), its path uses allowed actions only from the start state, and, if `applies_to` says `no page reload`, every click kept the document. It qualifies when, in addition, every snapshot-observable expectation holds: `url_path` by pathname; `role` by counting snapshot nodes page-wide (exact name for presence, substring for absence). `testid` expectations have no snapshot node (a bare div without a role) and are recorded as "not snapshot-observable; asserted by the replay locator". Observation never writes an expectation.
- **Path selection:** predicates whose `applies_to` starts with "The start state" are asserted at the start state, which must qualify. Exactly one other predicate is the target. Among its qualifying states the emitter picks the discovered path with the **fewest actions, then the lexicographically smallest action sequence** (per step: accessible name, then role; code-unit order). If none qualifies, nothing is emitted and `trace.md` reports what was explored.
- **Emission** (`emit_session.ts`): one spec named after the dedupe key. Steps come from the selected state's recorded transitions (each must start at the previous state, be an allowlisted unique candidate there, and keep the document); assertions come only from the charter, positives before absence checks, all hard `expect` with a `// declared (charter <feature> <expect id>)` marker. Presence checks use exact names scoped to the predicate's test id; absence checks use the substring locator page-wide. The emitter stops on a non-exact presence name, a missing or duplicate expectation id, a live name that contains or glyph-strips to a declared title without equalling it, a stale trace (allowlist, budget or start differ from the charter), guard violations, or a step it would have to invent. A dedupe key marked COVERED in `coverage.md` emits nothing.
- **Licence:** the bookmark bar is licence-gated, but the session spec does not call `pw.skipIfNoLicense()`. For a charter whose server must be licensed, an unlicensed server is a setup failure (`up.sh --session` fails first); a skip would report it as not-failed. Without a licence the declared bar assertions fail, and the session replay judge also treats any skipped test as FAIL.

## Storage state

`TestBrowser.login` -> `loginByAPI` writes `<playwright root>/storage_state/<timestamp>_<user>_<password>.json` (`e2e-tests/playwright/lib/src/browser_context.ts:177,184`). The directory name is hard-coded and the root comes from walking up `process.cwd()` (`lib/src/util.ts:118-156`); there is no env var or option to relocate it, so pilot runs write to the git-ignored `e2e-tests/playwright/storage_state/` like every other spec. Cleanup is the coordinator's runner's job.
