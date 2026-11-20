# infra interface for later owners

- **Base URL:** `http://127.0.0.1:${PILOT_PORT:-8065}`. Set `PW_BASE_URL` to exactly this value.
- **Playwright lib mode:** EXTERNAL server. Leave `PW_USE_TESTCONTAINERS` unset, so `ensureFeatureFlag` / `ensureDefaultServerEnv` restarts and `runMmctlLocal` are not available; the server env is fixed by `docker-compose.yml` (test service environment, `MM_LICENSE` pass-through).
- **Admin:** lib defaults `PW_ADMIN_USERNAME=sysadmin`, `PW_ADMIN_PASSWORD=Sys@dmin-sample1`, `PW_ADMIN_EMAIL=sysadmin@sample.mattermost.com`. Created as the first user by the seed (or the gate). It plays the "qa-admin" seeding role from `scenarios.json`; no separate `qa-admin` account exists.
- **Start:** `explorer-proto/infra/scripts/up.sh [--variant=default|swap-purpose-header|no-archive] [--no-seed]` (needs `MM_LICENSE` exported; no image pulls). Prints `ready: <base URL>` once the stack is up, the forwarder answers and the seed has run.
- **Stop:** `explorer-proto/infra/scripts/down.sh` (idempotent: forwarder SIGTERM, `docker compose down -v`, gate canary, seed manifest; all data is discarded).
- **Forwarder lifecycle:** started in the background by `up.sh`, pid in `.run/forwarder.pid`, log in `.run/forwarder.log`; stopped by `down.sh`. It resolves the Mattermost IP on `explorer-pilot_pilot_internal` at startup and re-resolves after a refused/unreachable upstream. Only binds `127.0.0.1`.
- **Local mode:** `docker exec explorer-pilot-mattermost /mattermost/bin/mmctl --local …` works (no shell needed). Never `docker exec … env`.

## Seed

`scripts/seed.mjs` (run by `up.sh`; can be re-run against a live stack) is API-based, deterministic and idempotent, and reads every name, purpose, header and archived flag from the `PILOT-01` / `PILOT-02` `fixture_setup` sections of `explorer-proto/scenarios.json`. It creates team `qa-team`, user `qa-user` (`system_user`, `team_user`, onboarding preferences from `lib/src/server/user.ts`), and channels `qa-sandbox`, `release-planning` and `legacy-roadmap`. It adds `qa-user` to each channel, archives `legacy-roadmap` after that, and finally marks `release-planning` then `qa-sandbox` viewed as `qa-user`. `scripts/verify_seed.mjs [--variant=…]` reads the state back through the admin API.

Negative-control variants change seed data only (never names, URLs, membership or accessible names):

| Variant | Effect |
| --- | --- |
| `default` | values exactly as in `scenarios.json` |
| `swap-purpose-header` | purpose and header strings swapped between `qa-sandbox` and `release-planning` (PILOT-01 control) |
| `no-archive` | `legacy-roadmap` left active (PILOT-02 control) |

## Signed-in setup

`pw.initSetup()` creates random team/user names, so pilot specs must not use it for the signed-in user. They use the fixed seeded identity from `.run/seed-manifest.json` (git-ignored, synthetic data only) and sign in through the framework: `pw.testBrowser.login(manifest.user)` (`TestBrowser.login` → `loginByAPI`, `e2e-tests/playwright/lib/src/browser_context.ts:24-36,156-196`), which writes the storage state itself. Infra does not create storage state.

Manifest schema (`explorer-pilot-seed/v1`):

```json
{
  "schema": "explorer-pilot-seed/v1",
  "base_url": "http://127.0.0.1:8065",
  "variant": "default | swap-purpose-header | no-archive",
  "team": {"id": "string", "name": "qa-team", "display_name": "QA Team"},
  "user": {"id": "string", "username": "qa-user", "password": "string (synthetic)", "email": "qa-user@sample.mattermost.com", "roles": "system_user"},
  "channels": {
    "<channel name>": {"id": "string", "name": "string", "display_name": "string", "purpose": "string", "header": "string", "archived": true, "url_path": "/qa-team/channels/<channel name>"}
  }
}
```

`channels` has keys `qa-sandbox`, `release-planning` and `legacy-roadmap`; `purpose` / `header` / `archived` reflect the variant actually seeded. Expected values in specs must still come from `scenarios.json`, not from the manifest.
