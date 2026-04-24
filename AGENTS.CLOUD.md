# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This environment is configured for **Mattermost Team Edition** development only.

| Repository | Location | Purpose |
|------------|----------|---------|
| `mattermost/mattermost` | `/workspace` | Primary monorepo (Go server + React webapp) |

PostgreSQL 14 is the only required external dependency, run via Docker Compose.

The startup update script is expected to prepare Docker, Node/npm, and web dependencies before agent work begins.

### Bootstrap checklist (run this first in every fresh cloud session)

```bash
source "$HOME/.nvm/nvm.sh"
nvm use 24.11
cd /workspace/webapp && npm install
```

Why: snapshots may not always include a valid `webapp/node_modules` state, and the webapp watcher often fails or hangs if dependencies are stale.

### Localization/i18n

When editing translation strings, changes must ONLY be made to the relevant en.json. You MUST NOT change any other localization files.

### Starting services

1. **Docker should already be initialized by startup script.**
   Run a quick check:
   ```bash
   docker ps
   ```
   If this fails, consider the environment initialization incomplete and re-run VM startup setup.

2. **Start Team Edition server + webapp:**
   ```bash
   cd /workspace/server && make run
   ```
   This starts dependency containers, runs the server on `:8065`, and starts webpack.

3. **Optional split-mode startup (recommended when `make run` web watcher appears stuck):**
   - In one terminal:
     ```bash
     cd /workspace/server && make run-server
     ```
   - In a second terminal:
     ```bash
     source "$HOME/.nvm/nvm.sh" && nvm use 24.11
     cd /workspace/webapp/channels && npm run dev-server
     ```

4. **Restart server after code changes:**
   ```bash
   cd /workspace/server && make restart-server
   ```

### Environment verification checklist

After startup, verify all three checks:

```bash
curl -sS http://localhost:8065/api/v4/system/ping
curl -sSI http://localhost:9005
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Expected:
- ping returns JSON containing `"status":"OK"`;
- port `9005` returns `HTTP/1.1 200 OK`;
- dependency containers (postgres/redis/minio/etc.) are running.

### Key gotchas

- The server auto-generates `server/config/config.json` on first run; default SQL points to `postgres://mmuser:mostest@localhost/mattermost_test` matching Docker Compose.
- The first user created via `/api/v4/users` gets `system_admin` role automatically.
- SMTP errors and plugin directory warnings on startup are expected in dev — non-blocking.
- The VM's global gitconfig may have `url.*.insteadOf` rules embedding the default Cursor agent token, which only has access to `mattermost/mattermost`.

### Lint, test, and build

All commands below run from `/workspace` unless stated otherwise.

**Server (team):**
- **Run:** `cd server && make run`
- **Restart:** `cd server && make restart-server`
- **Lint:** `cd server && make check-style`
- **Tests:** `cd server && make test-server` (needs Docker). Quick: `cd server && go test ./public/model/...`

**Webapp:** run from `/workspace/webapp/`
- **Lint:** `npm run check`
- **Tests:** `npm run test` (Jest 30)
- **Type check:** `npm run check-types`
- **Build:** `npm run build`

### Browser automation

**agent-browser** (Vercel) is installed globally. It provides a higher-level CLI for browser automation — navigation, clicking, typing, screenshots, accessibility snapshots, and visual diffs. Usage: `agent-browser <command>`. See the agent-browser skill for more information.

### Versions

- Node.js: see `.nvmrc`; `nvm use` from workspace root.
- Go: see `server/go.mod`.
