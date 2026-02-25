## Cursor Cloud specific instructions

This is the Mattermost monorepo. The webapp lives under `webapp/`.

### Environment

- Node.js v24+ and npm v11+ are required (managed via nvm).
- Source nvm before running any node/npm commands: `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
- Go toolchain is at `/usr/local/go/bin` — add to PATH when needed.

### webapp dependencies

- `cd /workspace/webapp && npm install` installs all workspace dependencies.
- The `postinstall` script automatically builds shared workspaces (`platform/types`, `platform/client`, `platform/components`, `platform/shared`).

### Running tests

#### Go server tests
- Run from `/workspace/server` with `PATH=/usr/local/go/bin:$PATH`.
- Example (small package): `go test ./public/model/... -count=1 -short -timeout 120s`
- The `-short` flag skips long-running integration tests that need a database.

#### Webapp tests
- To run tests for a specific workspace, use `npm run test --workspace <name>` from `webapp/`.
  - Example: `npm run test --workspace platform/client`
- Do **not** use `npx jest --testPathPatterns="platform/client"` from the root — it picks up both compiled `lib/` tests and uncompiled `src/` TypeScript tests without the correct transform config, causing failures.
- The `platform/client` workspace has 4 test suites / 27 tests (websocket, client4, helpers, errors).

### Linting

- `npm run check` from `webapp/` runs ESLint across all workspaces.
- Per-workspace: `npm run check --workspace <name>`.
