# Codebase Structure

**Analysis Date:** 2026-01-13

## Directory Layout

```
mattermost/
├── server/                          # Go backend (HTTP + business logic)
│   ├── cmd/                         # CLI entry points
│   ├── channels/                    # Core messaging domain
│   ├── platform/                    # Shared platform services
│   ├── public/                      # Public API and models
│   ├── einterfaces/                 # Enterprise plugin interfaces
│   ├── enterprise/                  # Enterprise features
│   ├── config/                      # Configuration management
│   └── i18n/                        # Internationalization
│
├── webapp/                          # React/TypeScript frontend
│   ├── channels/                    # Main web application
│   ├── platform/                    # Shared libraries
│   └── scripts/                     # Build scripts
│
├── api/                             # OpenAPI specification
│   ├── v4/                          # REST API v4 docs
│   └── playbooks/                   # Playbooks API docs
│
├── e2e-tests/                       # End-to-end tests
│   ├── playwright/                  # Playwright tests
│   └── cypress/                     # Cypress tests
│
├── tools/                           # Development tools
└── .github/                         # GitHub Actions CI/CD
```

## Directory Purposes

**server/cmd/**
- Purpose: CLI entry points and command definitions
- Contains: Main executables and command handlers
- Key files: `mattermost/main.go`, `mmctl/mmctl.go`
- Subdirectories:
  - `mattermost/` - Main server binary
  - `mattermost/commands/` - CLI commands (server, db, jobs)
  - `mmctl/` - Admin CLI tool

**server/channels/**
- Purpose: Core channels/messaging domain (~1,039 Go files)
- Contains: Business logic, API, store, jobs
- Key files: Entry points in `app/server.go`, `app/app.go`
- Subdirectories:
  - `api4/` - REST API v4 endpoints (151 files)
  - `app/` - Business logic layer (247 files)
  - `store/` - Data access abstraction
  - `store/sqlstore/` - SQL implementation (134 files)
  - `web/` - Web handlers (HTML, auth, static)
  - `wsapi/` - WebSocket API
  - `jobs/` - Background jobs (47 types)
  - `audit/` - Audit logging

**server/platform/services/**
- Purpose: Shared infrastructure services
- Contains: Cross-cutting concerns used by channels
- Key files: Service implementations
- Subdirectories:
  - `searchengine/` - Search/indexing
  - `cache/` - Caching service
  - `telemetry/` - Analytics and metrics
  - `imageproxy/` - Image proxy
  - `marketplace/` - Plugin marketplace
  - `remotecluster/` - Remote cluster support
  - `sharedchannel/` - Shared channels

**server/public/model/**
- Purpose: Public API models and types
- Contains: Data structures, validation, constants
- Key files: `user.go`, `channel.go`, `post.go`, `config.go`

**webapp/channels/**
- Purpose: Main web application (~3,545 TS/JS files)
- Contains: React components, Redux, utilities
- Key files: `src/entry.tsx`, `src/root.tsx`
- Subdirectories:
  - `src/components/` - React components (341 dirs)
  - `src/actions/` - Redux action creators (47 files)
  - `src/reducers/` - Redux reducers
  - `src/selectors/` - Redux selectors (34 files)
  - `src/client/` - API client wrapper
  - `src/utils/` - Utilities (118 modules)
  - `src/hooks/` - Custom React hooks
  - `src/types/` - TypeScript definitions
  - `src/i18n/` - Internationalization (70 dirs)
  - `src/sass/` - SCSS styles

**webapp/platform/**
- Purpose: Shared libraries (npm workspaces)
- Contains: Reusable packages across apps
- Subdirectories:
  - `client/` - Reusable API client SDK
  - `components/` - Shared UI components
  - `types/` - Shared TypeScript types
  - `mattermost-redux/` - Redux utilities
  - `eslint-plugin/` - Custom ESLint rules

## Key File Locations

**Entry Points:**
- `server/cmd/mattermost/main.go` - Server CLI entry
- `server/cmd/mattermost/commands/server.go` - HTTP server startup
- `server/cmd/mmctl/mmctl.go` - Admin CLI entry
- `webapp/channels/src/entry.tsx` - React app initialization
- `webapp/channels/src/root.html` - HTML template

**Configuration:**
- `server/config/` - Server configuration management
- `server/public/model/config.go` - Config structure (5,401 lines)
- `webapp/channels/webpack.config.js` - Webpack bundler
- `webapp/channels/tsconfig.json` - TypeScript config
- `.editorconfig` - Editor settings

**Core Logic:**
- `server/channels/app/` - Business logic (user, channel, post, team)
- `server/channels/store/sqlstore/` - Database operations
- `webapp/channels/src/actions/` - Redux async operations
- `webapp/platform/client/src/client4.ts` - API client (4,865 lines)

**Testing:**
- `server/channels/**/*_test.go` - Go unit/integration tests
- `webapp/channels/src/**/*.test.tsx` - Jest component tests
- `e2e-tests/playwright/specs/` - Playwright E2E tests
- `e2e-tests/cypress/` - Cypress E2E tests

**Documentation:**
- `README.md` - Project overview
- `CONTRIBUTING.md` - Contribution guide
- `webapp/STYLE_GUIDE.md` - Frontend coding standards
- `e2e-tests/playwright/CLAUDE.md` - E2E testing guidance
- `api/v4/source/` - OpenAPI specifications

## Naming Conventions

**Files:**
- Go: `snake_case.go` (e.g., `channel_store.go`, `user_actions.go`)
- TypeScript components: Directory per component (e.g., `about_build_modal/`)
- TypeScript utilities: `snake_case.ts` (e.g., `post_utils.ts`)
- Tests: `*_test.go` (Go), `*.test.ts(x)` (TypeScript)
- Hooks: `use*.ts` (e.g., `useBurnOnReadTimer.ts`)

**Directories:**
- `snake_case` for feature directories
- Plural for collections: `components/`, `actions/`, `services/`

**Special Patterns:**
- `*_store.go` - Store implementations
- `*_test.go` - Go tests in same directory
- `index.ts(x)` - Directory barrel exports
- `__tests__/` - Test directories (some areas)

## Where to Add New Code

**New Feature (Backend):**
- Primary code: `server/channels/app/{feature}.go`
- API endpoints: `server/channels/api4/{feature}.go`
- Store interface: `server/channels/store/store.go`
- SQL implementation: `server/channels/store/sqlstore/{feature}_store.go`
- Tests: `*_test.go` alongside source

**New Feature (Frontend):**
- Components: `webapp/channels/src/components/{feature}/`
- Actions: `webapp/channels/src/actions/{feature}_actions.ts`
- Reducers: `webapp/channels/src/reducers/entities/{feature}.ts`
- Selectors: `webapp/channels/src/selectors/{feature}.ts`
- Tests: `*.test.tsx` alongside source

**New API Endpoint:**
- Handler: `server/channels/api4/{resource}.go`
- Route: Register in `server/channels/api4/api.go`
- Client method: `webapp/platform/client/src/client4.ts`
- Types: `server/public/model/{resource}.go`, `webapp/platform/types/src/`

**Background Job:**
- Implementation: `server/channels/jobs/{job_name}/`
- Registration: `server/channels/app/server.go`

**Shared UI Component:**
- Implementation: `webapp/platform/components/src/`
- Export: Update barrel file

## Special Directories

**server/channels/store/sqlstore/**
- Purpose: SQL database implementations
- Source: Hand-written, matches store interfaces
- Committed: Yes

**server/channels/store/retrylayer/**
- Purpose: Auto-generated retry wrapper (17,617 lines)
- Source: Generated from store interfaces
- Committed: Yes (regenerate when interfaces change)

**server/channels/store/timerlayer/**
- Purpose: Auto-generated timing instrumentation (14,047 lines)
- Source: Generated from store interfaces
- Committed: Yes (regenerate when interfaces change)

**server/enterprise/**
- Purpose: Enterprise-only features
- Source: Separate licensing
- Committed: Yes (requires enterprise license to run)

**webapp/channels/build/**
- Purpose: Webpack build output
- Source: Generated during build
- Committed: No (in .gitignore)

**node_modules/**
- Purpose: npm dependencies
- Source: Installed via `npm install`
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-13*
*Update when directory structure changes*
