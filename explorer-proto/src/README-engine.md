# Explorer engine

Run from the repository root after `explorer-proto/infra/scripts/up.sh`. Node 24 runs the CLI directly (type stripping); Playwright, the browser and the TypeScript loader come from `e2e-tests/playwright/node_modules` through the git-ignored symlink `explorer-proto/node_modules -> ../e2e-tests/playwright/node_modules` (create it once with `ln -s ../e2e-tests/playwright/node_modules explorer-proto/node_modules`).

```bash
node explorer-proto/src/cli.ts explore      [--out=<dir>]   # bounded BFS -> <dir>/trace.json, trace.md
node explorer-proto/src/cli.ts emit         [--out=<dir>]   # trace.json + scenarios.json -> <dir>/*.spec.ts, trace.md
node explorer-proto/src/cli.ts replay       [--out=<dir>]   # runs the already-generated specs only (no explore/emit)
node explorer-proto/src/cli.ts guard-check  [--out=<dir>]   # network guard proof -> <dir>/guard-report.md
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
- `explore.pw.ts`: roots and allowlist come from `scenarios.json`; every candidate action runs in a fresh guarded context that replays the path from the root. State key = pathname + normalized aria snapshot (`snapshot.ts`).
- `absence_probe.pw.ts`: on the `no-archive` seed every declared absence locator must find its element (Unarchive needs `manage_team`, so it is reported UNCONFIRMED-BY-LIVE); on an archived seed each must find nothing.
- `emit.ts`: actions and locators come from the trace; assertions come only from `scenarios.json` `expected_outcome`, checked against the observed snapshots (a disagreement stops the scenario). Matrix rows marked COVERED in `coverage.md` are skipped.
