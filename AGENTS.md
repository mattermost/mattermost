# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Mattermost is an open-source collaboration platform with a Go backend (`server/`) and React/TypeScript frontend (`webapp/`). The two are developed and run separately. For detailed project structure and coding standards, see `webapp/CLAUDE.OPTIONAL.md` and the server `Makefile`.

### Required versions

- **Go**: See `server/.go-version` (currently 1.24.13). Must be on `PATH` at `/usr/local/go/bin`.
- **Node.js**: See `.nvmrc` (currently v24.11). Use `nvm use` to activate.
- **Docker**: Required for backing services (PostgreSQL, MinIO).

### Starting services

1. **Docker services** (PostgreSQL + MinIO minimum):
   ```
   cd server && ENABLED_DOCKER_SERVICES="postgres minio" make start-docker
   ```
2. **Go server** (with local mode for mmctl access):
   ```
   cd server && make setup-go-work
   export MM_SERVICESETTINGS_ENABLELOCALMODE=true
   go run ./cmd/mattermost
   ```
   Server listens on `:8065`. Local-mode socket at `/var/tmp/mattermost_local.socket`.
3. **Webapp dev server** (webpack-dev-server with hot reload, proxies API to :8065):
   ```
   cd webapp && npm run dev-server
   ```
   Serves at `http://localhost:9005`.

### Running the port command

Per repo rules: always run `wt port` to discover which port the Mattermost server is on before using the browser. If `wt` is unavailable, check ports 8065 (API) and 9005 (webapp dev server).

### Test credentials (after `make inject-test-data` or `mmctl sampledata`)

- **sysadmin** / `Sys@dmin-sample1` (system admin)
- **user-1** / `SampleUs@r-1` (regular user)

### Key commands reference

| Task | Server (`cd server`) | Webapp (`cd webapp`) |
|------|---------------------|---------------------|
| Lint | `make golangci-lint` | `npm run check` (ESLint + Stylelint across all workspaces) |
| Type check | `go vet ./...` | `npm run check-types` |
| Unit tests | `make test-server-quick` (no Docker needed) | `npm run test --workspace=channels` |
| Build | `go build ./cmd/mattermost` | `npm run build` |

### Gotchas

- The server Makefile auto-adds `minio` (and `openldap` for enterprise builds) to `ENABLED_DOCKER_SERVICES`. Override with `ENABLED_DOCKER_SERVICES="postgres minio"` for a minimal setup.
- `npm install` in `webapp/` triggers a `postinstall` that builds platform packages (`types`, `client`, `components`, `shared`). If types appear stale after pulling, re-run `npm install`.
- The server's `run-server` target requires `prepackaged-binaries` (mmctl). Build it first with `make mmctl-build` or use `go run ./cmd/mattermost` directly.
- Docker in the Cloud Agent VM requires `fuse-overlayfs` storage driver and `iptables-legacy`. These are configured at setup time.
- The webapp `--testPathPattern` Jest flag is deprecated; use `--testPathPatterns` (plural) instead.
