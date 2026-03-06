# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **dual-repo** Mattermost development environment:

| Repository | Location | Purpose |
|------------|----------|---------|
| `mattermost/mattermost` | `/workspace` | Primary monorepo (Go server + React webapp) |
| `mattermost/enterprise` | `$HOME/enterprise` | Private enterprise code (Go, linked via `go.work`) |
| `mattermost/mattermost-plugin-agents` | `$HOME/mattermost-plugin-agents` | Optional AI plugin for validation/testing |

The server has three main components:

| Service | Language | Directory | Dev Command |
|---------|----------|-----------|-------------|
| **Server** (Go API + WebSocket) | Go 1.24 | `/workspace/server/` | See "Starting services" below |
| **Webapp** (React frontend) | TypeScript/Node 24 | `/workspace/webapp/` | `npm run run` from `webapp/` (or `make run` from `webapp/`) |
| **Enterprise** (Go) | Go 1.24 | `$HOME/enterprise/` | Linked into server via `go.work` — no separate run command |

PostgreSQL 14 is the only required external dependency, run via Docker Compose.

### Repository layout rules

- `/workspace` is always the `mattermost/mattermost` checkout. Never clone other repos inside it.
- Enterprise lives at `$HOME/enterprise` (NOT `../../enterprise` or inside `/workspace`).
- Plugin lives at `$HOME/mattermost-plugin-agents`.
- The update script clones both repos if missing using `gh repo clone` (requires `GH_TOKEN` exported from `CURSOR_GH_TOKEN`).

### Git authentication

The VM has `gh` CLI pre-authenticated, but the default Cursor agent token only has access to `mattermost/mattermost`. For cross-repo operations:

1. Export `GH_TOKEN` from `CURSOR_GH_TOKEN`:
   ```
   export GH_TOKEN="$CURSOR_GH_TOKEN"
   ```
2. The global gitconfig has `url.*.insteadOf` rules that rewrite GitHub URLs. If these rules embed the wrong token, remove them:
   ```
   git config --global --unset-all 'url.https://x-access-token:<old-token>@github.com/.insteadof'
   ```
   Then run `gh auth setup-git` with `GH_TOKEN` set so the credential helper uses the correct token.
3. Never print, echo, or log tokens. Never embed tokens in commit messages or config files.

### Starting services

1. **Docker (PostgreSQL):** From `server/`, run `make start-docker`. Only postgres is needed; to limit services, create `server/config.override.mk` with `ENABLED_DOCKER_SERVICES = postgres`.
2. **Go workspace setup (with enterprise):**
   ```
   cd /workspace/server && make BUILD_ENTERPRISE_DIR="$HOME/enterprise" setup-go-work
   ```
   This creates `go.work` that links `.`, `./public`, and `$HOME/enterprise`.
3. **Build the enterprise server binary:**
   ```
   cd /workspace/server && go build -tags 'enterprise sourceavailable' \
     -ldflags '-X "github.com/mattermost/mattermost/server/public/model.BuildNumber=dev" -X "github.com/mattermost/mattermost/server/public/model.BuildEnterpriseReady=true"' \
     -o ./bin/mattermost ./cmd/mattermost
   ```
4. **Run the enterprise server:**
   ```
   cd /workspace/server && MM_PLUGINSETTINGS_ENABLEUPLOADS=true MM_PLUGINSETTINGS_ENABLE=true ./bin/mattermost
   ```
   The server listens on `:8065`. Add `&` to background it.
5. **Set SiteURL** (required for plugin deployment and other features):
   ```
   curl -s -X PUT http://localhost:8065/api/v4/config/patch \
     -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"ServiceSettings": {"SiteURL": "http://localhost:8065"}}'
   ```
6. **Webapp:** From `webapp/`, run `make run` (builds and watches with webpack) or `make dev` (webpack-dev-server with HMR). The compiled assets land in `webapp/channels/dist/`, which the server serves via the `server/client` symlink.
7. **Client symlink:** Must exist at `server/client -> ../webapp/channels/dist`. Created automatically by `make run-server` or manually with `ln -nfs ../webapp/channels/dist /workspace/server/client`.

### Plugin deployment (mattermost-plugin-agents)

From `$HOME/mattermost-plugin-agents`, with the enterprise server running and SiteURL configured:

```
export PATH=/usr/local/go/bin:$PATH
MM_SERVICESETTINGS_SITEURL=http://localhost:8065 MM_ADMIN_USERNAME=sysadmin MM_ADMIN_PASSWORD='Sysadmin@123' make deploy
```

The plugin uses local-mode socket (`/var/tmp/mattermost_local.socket`) for deployment by default. Prerequisites:
- Server must be running with `MM_PLUGINSETTINGS_ENABLEUPLOADS=true`
- SiteURL must be set (either via env var or API config patch)

### Key gotchas

- The server auto-generates `server/config/config.json` on first run if it doesn't exist; default SQL settings point to `postgres://mmuser:mostest@localhost/mattermost_test` which matches the Docker Compose postgres container.
- The `server/client` symlink to `../webapp/channels/dist` must exist for the server to serve the frontend.
- The first user created via `/api/v4/users` gets `system_admin` role automatically.
- Plugins will fail to load in dev if the `client/plugins` directory doesn't exist — this is expected and non-blocking for core functionality.
- SMTP errors on startup are expected in dev (no mail server running); they don't block the server.
- When running `make` commands that involve enterprise, always pass `BUILD_ENTERPRISE_DIR="$HOME/enterprise"`.
- The enterprise repo must be on a compatible branch with the main repo. If builds fail with import errors, ensure both repos are on matching release branches.
- License errors in server logs ("Failed to read license set in environment") are normal in dev — enterprise features that require a license simply won't be available, but the server runs fine.

### Lint, test, and build

**With enterprise code:**
- **Server build:** `go build -tags 'enterprise sourceavailable' -o ./bin/mattermost ./cmd/mattermost/` from `server/`
- **Server vet:** `go vet -tags 'enterprise sourceavailable' ./cmd/mattermost/...` from `server/`
- **Server lint (full):** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" check-style` from `server/`
- **Server tests:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" test-server` from `server/` (needs Docker). Quick: `go test ./public/model/...`

**Webapp (unchanged):**
- **Lint:** `npm run check` from `webapp/`
- **Tests:** `npm run test` from `webapp/` (Jest 30)
- **Type check:** `npm run check-types` from `webapp/`
- **Build:** `npm run build` from `webapp/`

### Node.js and Go versions

- Node.js version is specified in `.nvmrc` (currently `24.11`); use `nvm use` from workspace root.
- Go version is specified in `server/go.mod` (currently `1.24.13`).

### Cross-repo PR workflow

When changes span both repos:
1. Create branches in each repo independently.
2. Commit and push each branch to its own origin.
3. Create PRs with explicit repo targeting:
   ```
   gh pr create --repo mattermost/mattermost ...
   gh pr create --repo mattermost/enterprise ...
   ```
4. In each PR body, link the companion PR and state merge order (typically enterprise first if server depends on new enterprise code).

### Default test credentials

- Admin: `sysadmin` / `Sysadmin@123` (created via first `/api/v4/users` POST)
- Team: `test-team` (created via API)
- Default channel: `town-square`
