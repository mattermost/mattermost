# Channel Info explorer pilot

A bounded explorer drives the Mattermost **Channel Info panel** (Info RHS) through Playwright text accessibility
snapshots only, then emits two Playwright specs whose actions and locators come from what it observed and whose
business assertions come only from `scenarios.json`. No LLM, no vision model, no screenshots, video or traces.

| Scenario | Matrix row | What it proves |
| --- | --- | --- |
| PILOT-01 | MX-05 | With Info open on `qa-sandbox`, a sidebar switch to `release-planning` makes the panel show the new channel and not the old one. |
| PILOT-02 | MX-21 | On archived `legacy-roadmap` a regular member sees `This channel is archived.` and no Unarchive, Add People, Edit, Notification Preferences or Channel Settings buttons. |

## Run

From the repository root:

```bash
explorer-proto/run-pilot.sh                 # = demo
explorer-proto/run-pilot.sh verify          # release gate; --repeat=N or PILOT_REPEAT (default 10)
explorer-proto/run-pilot.sh repeat [N]      # replay the committed generated/ specs N times (default 30)
explorer-proto/run-pilot.sh down            # teardown only
explorer-proto/run-pilot.sh help
```

Every command prints a banner per step and ends with a PASS/FAIL table and a final `DEMO:`, `VERIFY:` or `REPEAT:`
line. The exit code is 0 only if every row passed. Steps never route their status through `|| true`. The exit trap
always runs three things: the storage-state cleanup, a filename leak scan, and the teardown
(`infra/scripts/down.sh`, which keeps the images).

### demo

| Step | What it does |
| --- | --- |
| (a) preflight | Prints `git rev-parse HEAD`. Checks that Docker is linux/amd64, that `MM_LICENSE` is exported (name only), that both images are present by digest, that Node strips TypeScript and that `@playwright/test` is 1.62.1. Checks both browser builds in the Playwright cache (`PLAYWRIGHT_BROWSERS_PATH`, else `~/.cache/ms-playwright`). A missing build is a setup failure, and nothing is downloaded. Creates the git-ignored symlink `explorer-proto/node_modules -> ../e2e-tests/playwright/node_modules` if it is missing. |
| (b) gate + seed | `infra/scripts/gate.sh --keep` runs the isolation and license gate. Only `IsLicensed === 'true': PASS/FAIL` and the gate verdict are printed. An unlicensed server, or any gate failure, is a setup failure that stops the run before any pilot step. Then `infra/scripts/up.sh --variant=default` seeds the stack. |
| (c) explore + emit | `node explorer-proto/src/cli.ts explore` and then `emit`, with `--out=explorer-proto/infra/.run/pilot/<run>/out` (git-ignored). `generated/runs/` cannot be used because the replay config ignores `**/runs/**`. |
| (d) replay | Runs the generated specs only, each test in a fresh guarded context. Both must pass. |
| (e) guard-check | `cli.ts guard-check`. |
| (f) probe-absence | Shown as SKIP in demo. It runs in `verify`. |
| (g) leak scan | See [Secrets](#secrets). |
| (h) teardown | Runs from the exit trap. |

**Browser binaries.** The `chrome` project in the repo config is headless with `browserName: 'chromium'` and no
`channel`, so Playwright launches `chromium_headless_shell-1234` (`chrome-headless-shell`). `chromium-1234` is used
only for headed runs (`PW_HEADLESS=false`). Preflight requires both.

### verify

1. **Demo run 1.** If it fails, verify stops.
2. **Demo run 2.** Then `diff -r` of the two runs' specs, `trace.md` and `trace.json`, which must be byte-identical.
3. **Repeated replay.** The run-2 specs are replayed N times on the default seed (Playwright `--repeat-each`), and all
   2·N executions must pass. The report shows `X/Y passed`.
4. **Negative controls.** These replay the run-2 specs only, with no re-explore and no re-emit. The md5 of both spec
   files must be the same before and after. Each control is a **seed or role change that keeps navigation intact**.
   The two API controls are applied by small built-ins-only Node blocks inside `run-pilot.sh`, through the loopback
   forwarder. They take the admin from `PW_ADMIN_USERNAME` / `PW_ADMIN_PASSWORD` (lib defaults) and the base URL and
   ids from `infra/.run/seed-manifest.json`. They never print tokens or passwords.

   | Control | Change | Required result |
   | --- | --- | --- |
   | `release-purpose-changed` | Admin `PUT /api/v4/channels/{id}/patch` changes only the `release-planning` purpose. Then qa-user logs in and marks `release-planning` and `qa-sandbox` viewed again: the patch posts a system message, and the sidebar link name would otherwise gain ` unread`. Afterwards the declared purpose is restored (from `scenarios.json`, cross-checked against the manifest) and both channels are re-viewed. | PILOT-01 fails only at `expect.soft(info).toContainText('Release purpose bravo-91d2')`. The URL, region `Info` visible and `Close Info` assertions are not among the failures. PILOT-02 passes. |
   | `team-admin` | Admin `PUT /api/v4/teams/{team_id}/members/{user_id}/schemeRoles` with `scheme_admin: true, scheme_user: true`. Restored with `scheme_admin: false` and read back: the roles contain `team_user` and not `team_admin`. | PILOT-02 fails only at `expect(info.getByRole('button', {name: 'Unarchive', exact: true})).toHaveCount(0)` with `Received: 1`. PILOT-01 passes. |
   | `no-archive` | Gate plus `up.sh --variant=no-archive`, which keeps `legacy-roadmap` active. The default seed is restored the same way afterwards. | PILOT-02 fails only at `expect(info.getByText('This channel is archived.', {exact: true})).toBeVisible()`. It is a hard assertion, so the later checks do not run. PILOT-01 passes. |

   **Restore checks.** After the two API controls, `infra/scripts/verify_seed.mjs` reads the default seed back, and a
   replay on that same restored stack must pass both tests. After the default seed is re-applied following
   `no-archive`, both tests must pass again.
5. **Probes and guards.** `probe-absence` runs on `no-archive` and on `default`, followed by `guard-check`,
   `guard-race` (a teardown-race regression check on a local server) and a leak scan.

**The judge.** It is strict and reads the Playwright JSON report. A control passes only if all of these hold:

- The named test failed with result status `failed`, and the other test passed.
- Its errors are exactly the expected assertion. An error matches only on its code-frame call text, the first line
  of the message and the expected strings (`Expected substring: …`, `Received: 1`), never on line numbers.

The judge rejects:

- Any other failure.
- `Test timeout`.
- Hook, fixture or `Network guard violations` errors.
- A closed page.
- The statuses `timedOut` and `interrupted`.
- Report-level errors.

For each control it prints the failing test, the failing expect call and the first line of the message. These
controls verify the declared assertions against **seed/role changes, not product regressions**.

**Exploratory only.** The `swap-purpose-header` seed variant (`infra/scripts/up.sh --variant=swap-purpose-header`) is
not part of the gate. With it, six soft text assertions each wait the 10 s expect timeout, which together with setup
exceeds the 60 s test timeout. The run then ends in a location-less test timeout instead of failing at named
assertions.

### repeat

`repeat [N]` runs preflight, gate and seed, then replays the committed `generated/` specs N times with
`--repeat-each`. It requires all 2·N executions to pass and the spec md5 values to stay unchanged, then runs a leak
scan. It never regenerates the specs.

## Prerequisites

- `MM_LICENSE` exported in the invoking shell. The license is test-signed.
- Docker with a linux/amd64 server and Compose v2.
- Both images pulled. Nothing in the pilot pulls them (`--pull never`).
- The locked Playwright workspace: `e2e-tests/playwright/node_modules` with `@playwright/test` 1.62.1, and
  `chromium_headless_shell-1234` plus `chromium-1234` in the Playwright cache. The pilot runs no `npm install` and no
  `playwright install`.
- Node 24, which runs `src/cli.ts` with built-in type stripping.

## Pinned references

| Item | Value |
| --- | --- |
| Checkout | printed at run time by preflight (`git rev-parse HEAD`); not pinned here |
| Mattermost | `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` (linux/amd64) |
| PostgreSQL | `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` |
| Playwright | `@playwright/test` 1.62.1; launched browser `chromium_headless_shell-1234`; `chromium-1234` for headed runs |

**Licensed Enterprise setup:**

- The server is licensed through `MM_LICENSE`, which Compose passes through by name only.
- `IsLicensed === 'true'` is required. An unlicensed server is a setup failure, never a different-edition run.
- `MM_SERVICEENVIRONMENT=test` is set on the pilot Mattermost container only, as approved by the user, because the
  license is test-signed.
- Neither scenario asserts a licensed feature.

## Layout and ownership

| Path | Owner | Contents |
| --- | --- | --- |
| `infra/` | infra | Compose stack, loopback forwarder, isolation and license gate, seed and variants, seed read-back, leak scanner, teardown. See `infra/README.md` and `infra/INTERFACE.md`. |
| `src/`, `playwright.config.ts` | engine | Explorer, emitter, replay, network guard, guard check, guard race check and absence probe. See `src/README-engine.md`. |
| `generated/` | engine output | Committed reference specs, `trace.json`, `trace.md` and guard/race/probe reports. `reports/`, `test-results/` and `runs/` are git-ignored. |
| `coverage.md`, `scenarios.json` | QA design | Coverage ledger and matrix, and the declared scenarios, allowlists, fixtures, assertions and controls. |
| `run-pilot.sh`, `README.md` | coordinator | One-command wiring, controls, judge, exit codes and this document. |

There is no `explorer-proto/package.json`, on purpose: adding one would change module and ESLint resolution.

## Network model

- **Stack:** Compose project `explorer-pilot` uses one network, `pilot_internal`, with `internal: true`. Nothing
  publishes ports. Postgres runs on tmpfs, and the server's outbound features are disabled.
- **Forwarder:** the worker reaches Mattermost only through `infra/forwarder.mjs`. It is a built-ins-only TCP pipe
  from `127.0.0.1` to the Mattermost container IP, carries HTTP and WebSocket, refuses non-loopback binds and logs no
  payloads.
- **DIRECT (tested by the gate):**
  - Both containers are attached only to the internal network, and that network has `Internal=true`.
  - No ports are published, and the Postgres container has no default route.
  - Mattermost reports database status OK.
  - Through the forwarder, an HTTP ping succeeds and a WebSocket upgrade returns 101. The forwarder binds only to
    loopback and refuses `0.0.0.0`.
  - A boundary canary is reachable from its own bridge and unreachable from the Postgres container.
  - `IsLicensed === 'true'`, and the leak scans pass.
- **INFERRED:** the egress boundary of the Mattermost container itself. It is distroless and is not exec'd. It shares
  the only internal network with the tested Postgres container.

## Exact-origin guard

Every session, whether explore, replay, guard check or probe, uses a context created with `serviceWorkers: 'block'`.
The guard is installed on that context before the framework's `TestBrowser.login` opens a page, so it is active before
the first navigation. The guard allows exactly the manifest origin (scheme, host and port):

- `context.route('**/*')` aborts HTTP(S) requests to any other origin. It resolves 3xx responses itself and checks
  every hop.
- `context.routeWebSocket` closes WebSockets to any other origin.
- A listener records any escape as a violation, and a violation fails the session.
- Route handlers are tracked through teardown. Only a narrow set of teardown-caused errors counts as benign.

`guard-check` proves the guard in both exploration and replay mode:

- A second `127.0.0.1` origin and `localhost` on the same port are blocked, for navigation, fetch, image and WebSocket.
- The second server receives zero hits.
- `register()` resolves, but no service-worker script is ever requested.
- Redirects to another origin are blocked, and same-origin redirects are kept.

`guard-race` repeats session teardown under in-flight requests and requires zero unexpected handler errors.

## Secrets

`MM_LICENSE` reaches the server only by inheritance. Compose lists the variable name, and the engine CLI removes it
from the Playwright process env. `run-pilot.sh` never enables `set -x`, never echoes the environment, and checks the
license by name only. The value must never be printed, written to a file, hashed or measured.

`infra/scripts/leak_scan.mjs` works in memory and prints PASS/FAIL only. The leak scan (g) runs it over:

- the scratch output, `generated/reports`, `generated/test-results` and the `infra/.run` logs
- the committed `generated/` and sources, `run-pilot.sh` and this README
- `docker compose logs`, `git diff --cached` and `git diff HEAD -- explorer-proto`
- the **names** in `e2e-tests/playwright/storage_state`, piped on stdin (`ls -A`)

The names are scanned again after the storage-state cleanup.

**Storage state.** The framework's `TestBrowser.login` writes
`e2e-tests/playwright/storage_state/<timestamp>_<login>_<password>.json`, and that location is hard-coded
(`lib/src/browser_context.ts:177,184`). Each run records the existing entry names in memory at the start. On exit,
including after a failure, it deletes only entries that are new and whose name carries the seeded login id, read from
the seed manifest. Pre-existing entries and other users' entries are never touched, and the script never creates the
directory. Only counts are reported (created, deleted, remaining pre-existing); names are never printed.

These commands would expose the license. Never run them:

- `docker compose config`
- `docker inspect` without a narrow `--format`, or any template that touches `.Config.Env`
- `docker exec … env`, `docker exec … printenv`
- `env`, `printenv`, `set`, `ps eww`
- `set -x` or `bash -x` around these scripts
- `docker compose logs` piped anywhere other than `leak_scan.mjs`
- Writing the value to an `.env` file, an `--env-file`, a compose file, a log, test output or a commit

## Declared vs observed

- The explorer decides what is clickable, from an exact role-and-name allowlist in `scenarios.json`, and which
  locators exist. It records this in `trace.json`.
- Business assertions are emitted only from `scenarios.json` `expected_outcome`. Observed snapshots only confirm that
  those assertions match the live UI: a disagreement stops emission of that scenario. Expected values are never
  derived from an observed snapshot or from the seed manifest.
- Rows marked COVERED in `coverage.md` are not emitted.

## Unarchive evidence

`Unarchive` needs `manage_team`, which `qa-user` lacks. The explorer therefore never observes the button, and the
emitter labels the locator UNCONFIRMED-BY-LIVE. The absence probe also reports that it cannot be shown present on
`no-archive`.

The `team-admin` control makes `qa-user` a team admin for one replay. It requires PILOT-02 to fail at the Unarchive
count-0 assertion with `Received: 1`.

- **What this establishes:** the exact locator `getByRole('button', {name: 'Unarchive', exact: true})` detects the
  live 12.1.0 button.
- **What it does not establish:** anything about the Unarchive flow for a team admin (MX-22 stays open), or that a real
  permission-gating regression would be caught.

## Known limits

- The egress isolation of the Mattermost container is INFERRED, not tested.
- Chromium egress is guarded at the application level only (`src/guard.ts`). There is no host firewall.
- **Redirect blocking is tested on a local stand-in.** It uses a local origin and a second local server, not a real
  external host.
- **The state key ignores post content.** Snapshot normalization drops posts, so states that differ only in posts are
  merged.
- **Replay is sensitive to unread state.** An unseen post adds ` unread` to the sidebar link name, and the exact-name
  click then times out. The seed's final view calls and the re-view step in `release-purpose-changed` guard against
  this.
- **`MM_SERVICEENVIRONMENT=test`** is set on the pilot container only, as approved by the user.
- Only the 12.1.0 release image was run. Behaviour on master 12.2.0 is not verified.
- **The negative controls cover seed and role changes only.** They verify the assertions against those changes, not
  against product regressions.

## Out of scope

- CI integration
- Feature areas other than the Channel Info panel
- New Cypress tests
