# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Mattermost is a monorepo with two main services:

| Service | Language | Directory | Dev Command |
|---------|----------|-----------|-------------|
| **Server** (Go API + WebSocket) | Go 1.24 | `server/` | `go run ./cmd/mattermost` from `server/` |
| **Webapp** (React frontend) | TypeScript/Node 24 | `webapp/` | `npm run run` from `webapp/` (or `make run` from `webapp/`) |

PostgreSQL 14 is the only required external dependency, run via Docker Compose.

### Starting services

1. **Docker (PostgreSQL):** From `server/`, run `make start-docker`. Only postgres is needed; to limit services, create `server/config.override.mk` with `ENABLED_DOCKER_SERVICES = postgres`.
2. **Server:** From `server/`, run `make run-server` (this also sets up Go workspace, builds mmctl, validates Go version, starts Docker, and creates the `client` symlink). The server listens on `:8065`. Alternatively, run `go run ./cmd/mattermost` after running `make setup-go-work` and `make start-docker` separately.
3. **Webapp:** From `webapp/`, run `make run` (builds and watches with webpack) or `make dev` (webpack-dev-server with HMR). The compiled assets land in `webapp/channels/dist/`, which the server serves via the `server/client` symlink.

### Key gotchas

- The server auto-generates `server/config/config.json` on first run if it doesn't exist; default SQL settings point to `postgres://mmuser:mostest@localhost/mattermost_test` which matches the Docker Compose postgres container.
- The `server/client` symlink to `../webapp/channels/dist` must exist for the server to serve the frontend. `make run-server` creates it automatically via the `client` target.
- The first user created via `/api/v4/users` gets `system_admin` role automatically.
- The server runs in background by default (`RUN_SERVER_IN_BACKGROUND=true` in `config.mk`). When running manually with `go run`, add `&` to background it.
- Plugins will fail to load in dev if the `client/plugins` directory doesn't exist — this is expected and non-blocking for core functionality.
- SMTP errors on startup are expected in dev (no mail server running); they don't block the server.

### Lint, test, and build

- **Server lint:** `make check-style` from `server/` (runs `go vet` + `golangci-lint`)
- **Server tests:** `make test-server` from `server/` (needs Docker). For quick tests without full infra: `go test ./public/model/...`
- **Server build:** `go build ./cmd/mattermost/` from `server/`
- **Webapp lint:** `npm run check` from `webapp/` (ESLint + Stylelint across all workspaces)
- **Webapp tests:** `npm run test` from `webapp/` (Jest 30 across all workspaces)
- **Webapp type check:** `npm run check-types` from `webapp/`
- **Webapp build:** `npm run build` from `webapp/`

### Node.js and Go versions

- Node.js version is specified in `.nvmrc` (currently `24.11`); use `nvm use` from workspace root.
- Go version is specified in `server/go.mod` (currently `1.24.13`).
