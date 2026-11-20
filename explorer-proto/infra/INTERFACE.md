# infra interface for later owners

- **Base URL:** `http://127.0.0.1:${PILOT_PORT:-8065}`. Set `PW_BASE_URL` to exactly this value.
- **Playwright lib mode:** EXTERNAL server. Leave `PW_USE_TESTCONTAINERS` unset, so `ensureFeatureFlag` / `ensureDefaultServerEnv` restarts and `runMmctlLocal` are not available; the server env is fixed by `docker-compose.yml`.
- **Admin:** lib defaults `PW_ADMIN_USERNAME=sysadmin`, `PW_ADMIN_PASSWORD=Sys@dmin-sample1`, `PW_ADMIN_EMAIL=sysadmin@sample.mattermost.com`. Created as the first user by the gate's license probe, or by the lib's `baseGlobalSetup` on a fresh stack.
- **Start:** `explorer-proto/infra/scripts/up.sh` (needs `MM_LICENSE` exported; no image pulls). Prints `ready: <base URL>` and exits 0 once ping answers through the forwarder.
- **Stop:** `explorer-proto/infra/scripts/down.sh` (forwarder SIGTERM, `docker compose down -v`; all data is discarded).
- **Forwarder lifecycle:** started in the background by `up.sh`, pid in `explorer-proto/infra/.run/forwarder.pid`, log in `.run/forwarder.log`; stopped by `down.sh`. It resolves the Mattermost IP on `explorer-pilot_pilot_internal` at startup and re-resolves after a refused/unreachable upstream. Only binds `127.0.0.1`.
- **Local mode:** `docker exec explorer-pilot-mattermost /mattermost/bin/mmctl --local …` works (no shell needed). Never `docker exec … env`.
- **Seed (next round, not built yet):** API-based and deterministic, using the admin client. Creates the team, `qa-user`, channels with the fixed display names, purposes and headers from `explorer-proto/scenarios.json`, the archived `legacy-roadmap`, and the negative-control variants (`--swap-sandbox-release-text`, `--skip-archive-legacy`).
