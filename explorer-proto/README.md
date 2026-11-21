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
explorer-proto/run-pilot.sh          # = demo
explorer-proto/run-pilot.sh verify
explorer-proto/run-pilot.sh down     # teardown only
explorer-proto/run-pilot.sh help
```

`demo` runs these steps, prints a banner for each one and ends with a PASS/FAIL checklist. Any failure exits non-zero.
Teardown (`infra/scripts/down.sh`) always runs from an exit trap and keeps the images.

1. **Preflight:** prints `git rev-parse HEAD`. Checks that Docker is linux/amd64, that `MM_LICENSE` is exported (by
   name only), that both images are present by digest, that Node can strip TypeScript, that `@playwright/test` is
   1.62.1 and `chromium-1234` is installed. Creates the git-ignored symlink
   `explorer-proto/node_modules -> ../e2e-tests/playwright/node_modules` if it is missing.
2. **Gate and seed:** `infra/scripts/gate.sh --keep` runs the isolation and license gate. The script prints only
   `IsLicensed === 'true': PASS|FAIL` and the gate verdict. A FAIL is a setup failure and stops the run before any
   pilot step. Then `infra/scripts/up.sh --variant=default` seeds the stack.
3. **Explore and emit:** `node explorer-proto/src/cli.ts explore` and then `emit`, both with
   `--out=explorer-proto/infra/.run/pilot/<run>/out`. That directory is git-ignored. `generated/runs/` cannot be used
   because the replay config ignores `**/runs/**`.
4. **Replay:** runs the generated specs only, each in a fresh guarded context. Both specs must pass.
5. **Guard check:** `cli.ts guard-check`.
6. **Leak scan:** `infra/scripts/leak_scan.mjs` scans the scratch output, `generated/reports`,
   `generated/test-results`, the `infra/.run` logs, the committed `generated/` and sources, this README,
   `docker compose logs`, `git diff --cached` and `git diff HEAD -- explorer-proto`. It prints PASS/FAIL only.

`verify` runs these steps in order:

1. It runs `demo` twice, as `run-1` and `run-2`, each with its own stack.
2. It runs `diff -r` on the generated specs of the two runs, which must be byte-identical, and also compares
   `trace.json` and `trace.md`.
3. It records the md5 of the `run-2` specs.
4. Negative controls replay the `run-2` specs without regenerating them:
   - Seed `swap-purpose-header`. PILOT-01 must fail, and only at the seed-bound purpose/header text assertions,
     including both `Release purpose/header bravo-91d2` lines. PILOT-02 must pass.
   - Seed `no-archive`. PILOT-02 must fail, and only at the `This channel is archived.` assertion. PILOT-01 must pass.
5. It runs `probe-absence` on `no-archive` and on `default`, then `guard-check` and a final leak scan.
6. It checks that the spec md5 values are unchanged.

A control that does not fail, or that fails at a different assertion, is a verification FAIL. The final table lists
the failing assertion lines. Each line is the spec source line at the error location in the Playwright JSON report,
so it contains no ports or URLs. Logs and reports for every step are written to `infra/.run/pilot/`.

## Prerequisites

- `MM_LICENSE` exported in the invoking shell. The license is test-signed.
- Docker with a linux/amd64 server and Compose v2.
- Both images pulled. Nothing in the pilot pulls them (`--pull never`).
- The locked Playwright workspace: `e2e-tests/playwright/node_modules` with `@playwright/test` 1.62.1 and the
  `chromium-1234` browser. The pilot runs no `npm install` and no `playwright install`.
- Node 24, which runs `src/cli.ts` with built-in type stripping.

## Pinned references

| Item | Value |
| --- | --- |
| Checkout | printed at run time by preflight (`git rev-parse HEAD`); not pinned here |
| Mattermost | `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` (linux/amd64) |
| PostgreSQL | `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` |
| Playwright | `@playwright/test` 1.62.1, browser `chromium-1234` |

## Layout and ownership

| Path | Owner | Contents |
| --- | --- | --- |
| `infra/` | infra | Compose stack, loopback forwarder, isolation and license gate, seed and variants, leak scanner, teardown. See `infra/README.md` and `infra/INTERFACE.md`. |
| `src/`, `playwright.config.ts` | engine | Explorer, emitter, replay, network guard, guard check and absence probe. See `src/README-engine.md`. |
| `generated/` | engine output | Committed reference specs, `trace.json`, `trace.md` and guard/probe reports. `reports/`, `test-results/` and `runs/` are git-ignored. |
| `coverage.md`, `scenarios.json` | QA design | Coverage ledger and matrix, and the declared scenarios, allowlists, fixtures, assertions and controls. |
| `run-pilot.sh`, `README.md` | coordinator | One-command wiring, exit codes and this document. |

There is no `explorer-proto/package.json`, on purpose: adding one would change module and ESLint resolution.

## Network model

- **Stack:** Compose project `explorer-pilot` uses one network, `pilot_internal`, with `internal: true`. Nothing
  publishes ports (no `ports:`). Postgres runs on tmpfs, and the server's outbound features are disabled.
- **Forwarder:** the worker reaches Mattermost only through `infra/forwarder.mjs`. It is a built-ins-only TCP pipe
  from `127.0.0.1` to the Mattermost container IP, carries HTTP and WebSocket, refuses non-loopback binds and logs no
  payloads.
- **DIRECT (tested by the gate):**
  - Both containers are attached only to the internal network, and that network has `Internal=true`.
  - No ports are published, and the Postgres container has no default route.
  - Mattermost reports database status OK.
  - Through the forwarder, an HTTP ping succeeds and a WebSocket upgrade returns 101. The forwarder binds only to
    loopback and refuses `0.0.0.0`.
  - A boundary canary on a separate local bridge is reachable from that bridge and unreachable from the Postgres
    container.
  - `IsLicensed === 'true'`, and the leak scans pass.
- **INFERRED:** the boundary of the Mattermost container itself. It is distroless and is not exec'd. It shares the only
  internal network with the tested Postgres container.

## Exact-origin guard

Every session, whether explore, replay, guard check or probe, uses a context created with `serviceWorkers: 'block'`.
The guard is installed on that context before the framework's `TestBrowser.login` opens a page, so it is active before
the first navigation. The guard allows exactly the manifest origin (scheme, host and port):

- `context.route('**/*')` aborts HTTP(S) requests to any other origin. It resolves 3xx responses itself and checks
  every hop.
- `context.routeWebSocket` closes WebSockets to any other origin.
- A listener records any escape as a violation, and a violation fails the session.

`guard-check` proves the guard in both exploration and replay mode:

- A second `127.0.0.1` origin and `localhost` on the same port are blocked, for navigation, fetch, image and WebSocket.
- The second server receives zero hits.
- `register()` resolves, but no service-worker script is ever requested.
- Redirects to another origin are blocked, and same-origin redirects are kept.

## Secrets

`MM_LICENSE` reaches the server only by inheritance. Compose lists the variable name, and the engine CLI removes it
from the Playwright process env. `run-pilot.sh` never enables `set -x`, never echoes the environment, and checks the
license by name only. The value must never be printed, written to a file, hashed or measured. Leak checks use only
`infra/scripts/leak_scan.mjs`, which works in memory and prints PASS/FAIL.

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

## Known limits

- **Unarchive is UNCONFIRMED-BY-LIVE.** The button needs `manage_team`, which `qa-user` lacks, so its exact name comes
  from source (`channel_info_rhs.tsx`). The absence probe confirms every other absence locator against the
  `no-archive` seed.
- **Redirect blocking is tested on a local stand-in.** The guard check uses two local HTTP servers, not Mattermost,
  because the pilot UI has no cross-origin redirect.
- **`MM_SERVICEENVIRONMENT=test`** is set on the pilot Mattermost container only, as approved by the user, because the
  license is test-signed.
- **The state key ignores post content.** Snapshot normalization drops posts and the live post summary, so states that
  differ only in posts are merged.

## Out of scope

- CI integration
- Feature areas other than the Channel Info panel
- New Cypress tests
