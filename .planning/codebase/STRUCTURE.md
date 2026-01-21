# Codebase Structure

**Analysis Date:** 2026-01-21

## Directory Layout

```
mattermost/
├── api/                    # OpenAPI specifications
├── server/                 # Go backend (main codebase)
│   ├── channels/           # Core channels product
│   │   ├── api4/           # REST API handlers
│   │   ├── app/            # Business logic layer
│   │   ├── db/             # Database migrations
│   │   ├── jobs/           # Background job workers
│   │   ├── store/          # Data access layer
│   │   ├── utils/          # Server utilities
│   │   ├── web/            # Web request handling
│   │   └── wsapi/          # WebSocket API
│   ├── cmd/                # CLI entrypoints
│   ├── config/             # Default configurations
│   ├── einterfaces/        # Enterprise interface definitions
│   ├── enterprise/         # Enterprise module loader
│   ├── public/             # Public Go module (shared types)
│   │   ├── model/          # Data models/types
│   │   ├── plugin/         # Plugin API
│   │   ├── pluginapi/      # Plugin helper APIs
│   │   └── shared/         # Shared utilities
│   └── platform/           # Platform services
├── webapp/                 # Frontend codebase
│   ├── channels/           # Channels webapp
│   │   └── src/
│   │       ├── actions/    # View-specific actions
│   │       ├── components/ # React components
│   │       ├── packages/mattermost-redux/ # State management
│   │       ├── reducers/   # View-specific reducers
│   │       ├── selectors/  # View-specific selectors
│   │       └── store/      # Store configuration
│   └── platform/           # Shared frontend modules
│       ├── client/         # API client (Client4)
│       ├── components/     # Shared UI components
│       └── types/          # TypeScript type definitions
├── e2e-tests/              # End-to-end tests
│   ├── cypress/            # Cypress tests
│   └── playwright/         # Playwright tests
└── tools/                  # Build/dev tools
```

## Directory Purposes

**`server/channels/api4/`**
- Purpose: REST API endpoints, HTTP handlers
- Contains: Go files per feature domain (e.g., `recap.go`, `channel.go`)
- Key files: `api.go` (route registration), `apitestlib.go` (test helpers)

**`server/channels/app/`**
- Purpose: Business logic, feature implementations
- Contains: Domain service files (e.g., `recap.go`, `summarization.go`)
- Key files: `server.go` (server lifecycle), `app.go` (App struct)

**`server/channels/store/sqlstore/`**
- Purpose: SQL database operations
- Contains: Store implementations (e.g., `recap_store.go`)
- Key files: `store.go` (SqlStore struct), `*_store.go` per domain

**`server/channels/jobs/`**
- Purpose: Background job workers
- Contains: Subdirectories per job type (e.g., `recap/worker.go`)
- Key files: `workers.go` (worker registration)

**`server/channels/db/migrations/`**
- Purpose: Database schema migrations
- Contains: `postgres/` with numbered `.up.sql` and `.down.sql` files
- Key files: `migrations.list` (migration index)

**`server/public/model/`**
- Purpose: Shared data types, constants, validation
- Contains: Go structs for all entities (e.g., `recap.go`, `channel.go`)
- Key files: `feature_flags.go`, `websocket_message.go`, `job.go`

**`webapp/channels/src/components/`**
- Purpose: React UI components
- Contains: Feature directories (e.g., `recaps/`, `create_recap_modal/`)
- Key files: Feature components with `.tsx`, `.scss`, `.test.tsx`

**`webapp/channels/src/packages/mattermost-redux/src/`**
- Purpose: Redux state management
- Contains: `actions/`, `reducers/`, `selectors/`, `action_types/`
- Key files: Domain-specific files (e.g., `actions/recaps.ts`)

**`webapp/platform/client/src/`**
- Purpose: HTTP API client
- Contains: `client4.ts` with all API methods
- Key files: `client4.ts` (single large file with typed API calls)

**`webapp/platform/types/src/`**
- Purpose: TypeScript type definitions
- Contains: Type files per domain (e.g., `recaps.ts`, `channels.ts`)
- Key files: `store.ts` (GlobalState), `index.ts` (exports)

## Key File Locations

**Entry Points:**
- `server/cmd/mattermost/main.go`: Server CLI entrypoint
- `webapp/channels/src/entry.tsx`: Webapp entrypoint
- `webapp/channels/src/root.tsx`: React root component

**Configuration:**
- `server/config/default.json`: Default server config
- `webapp/channels/webpack.config.js`: Webpack build config
- `webapp/channels/tsconfig.json`: TypeScript config

**Core Logic:**
- `server/channels/app/server.go`: Server struct and lifecycle
- `server/channels/api4/api.go`: API route registration
- `server/channels/store/store.go`: Store interface definitions

**Recap Feature:**
- `server/public/model/recap.go`: Recap data types
- `server/channels/api4/recap.go`: Recap REST endpoints
- `server/channels/app/recap.go`: Recap business logic
- `server/channels/app/summarization.go`: AI summarization
- `server/channels/store/sqlstore/recap_store.go`: Recap DB operations
- `server/channels/jobs/recap/worker.go`: Recap job worker
- `server/channels/db/migrations/postgres/000149_create_recaps.up.sql`: Schema
- `webapp/platform/types/src/recaps.ts`: Recap TypeScript types
- `webapp/platform/client/src/client4.ts`: Recap API client methods
- `webapp/channels/src/packages/mattermost-redux/src/actions/recaps.ts`: Redux actions
- `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/recaps.ts`: Reducer
- `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/recaps.ts`: Selectors
- `webapp/channels/src/packages/mattermost-redux/src/action_types/recaps.ts`: Action types
- `webapp/channels/src/components/recaps/`: Recaps list UI
- `webapp/channels/src/components/create_recap_modal/`: Create modal UI
- `webapp/channels/src/components/recaps_link/`: Sidebar link

**Testing:**
- `server/channels/app/recap_test.go`: App layer tests
- `server/channels/store/sqlstore/recap_store_test.go`: Store tests
- `webapp/channels/src/components/recaps/*.test.tsx`: Component tests
- `e2e-tests/cypress/`: E2E Cypress tests
- `e2e-tests/playwright/`: E2E Playwright tests

## Naming Conventions

**Files:**
- Go: `snake_case.go` (e.g., `recap_store.go`, `recap_test.go`)
- TypeScript: `snake_case.ts/.tsx` (e.g., `recaps.ts`, `recap_item.tsx`)
- Tests: `*_test.go` (Go), `*.test.tsx` (TypeScript)
- Styles: `component_name.scss` alongside component

**Directories:**
- Go packages: `lowercase` (e.g., `sqlstore`, `api4`)
- React components: `snake_case` directories (e.g., `create_recap_modal`)
- Job workers: `lowercase` per job type (e.g., `recap/`)

**Types/Interfaces:**
- Go structs: `PascalCase` (e.g., `Recap`, `RecapChannel`)
- Go interfaces: `PascalCase` with suffix (e.g., `RecapStore`)
- TypeScript types: `PascalCase` (e.g., `Recap`, `GlobalState`)
- Redux action types: `SCREAMING_SNAKE_CASE` (e.g., `CREATE_RECAP_SUCCESS`)

**Functions:**
- Go exported: `PascalCase` (e.g., `CreateRecap`, `GetRecap`)
- Go unexported: `camelCase` (e.g., `fetchPostsForRecap`)
- TypeScript: `camelCase` (e.g., `createRecap`, `getRecaps`)

## Where to Add New Code

**New Backend Feature:**
1. Types: `server/public/model/{feature}.go`
2. Store interface: Add to `server/channels/store/store.go`
3. Store impl: `server/channels/store/sqlstore/{feature}_store.go`
4. Migrations: `server/channels/db/migrations/postgres/000XXX_*.sql`
5. App logic: `server/channels/app/{feature}.go`
6. API routes: `server/channels/api4/{feature}.go`, register in `api.go`
7. Tests: `*_test.go` files alongside implementations

**New Background Job:**
1. Worker: `server/channels/jobs/{jobtype}/worker.go`
2. Job type constant: Add to `server/public/model/job.go`
3. Register worker: Update `server/channels/app/server.go` imports and `initJobs()`
4. Create job from app layer via `a.CreateJob()`

**New Frontend Feature:**
1. Types: `webapp/platform/types/src/{feature}.ts`, export in `index.ts`
2. Client methods: Add to `webapp/platform/client/src/client4.ts`
3. Action types: `webapp/channels/src/packages/mattermost-redux/src/action_types/{feature}.ts`
4. Actions: `webapp/channels/src/packages/mattermost-redux/src/actions/{feature}.ts`
5. Reducer: `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/{feature}.ts`
6. Register reducer: Update `reducers/entities/index.ts`
7. Selectors: `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/{feature}.ts`
8. Components: `webapp/channels/src/components/{feature_name}/`
9. Add store state: Update `webapp/platform/types/src/store.ts`

**New React Component:**
- Implementation: `webapp/channels/src/components/{component_name}/{component_name}.tsx`
- Styles: `webapp/channels/src/components/{component_name}/{component_name}.scss`
- Tests: `webapp/channels/src/components/{component_name}/{component_name}.test.tsx`
- Index: `webapp/channels/src/components/{component_name}/index.ts`

**Utilities:**
- Server: `server/channels/utils/` or `server/public/utils/`
- Webapp: `webapp/channels/src/utils/` or `webapp/platform/*/src/utils/`

## Special Directories

**`server/enterprise/`**
- Purpose: Loads enterprise features via build tags
- Generated: No, but conditionally compiled
- Committed: Yes

**`server/einterfaces/`**
- Purpose: Interface definitions for enterprise features
- Generated: Mocks are generated (`einterfaces/mocks/`)
- Committed: Yes

**`server/channels/store/storetest/mocks/`**
- Purpose: Generated mock implementations for testing
- Generated: Yes, via mockery
- Committed: Yes

**`webapp/channels/src/i18n/`**
- Purpose: Internationalization strings
- Generated: No
- Committed: Yes
- Key file: `en.json` for English strings

**`node_modules/`, `vendor/`**
- Purpose: External dependencies
- Generated: Yes, from package managers
- Committed: No (gitignored)

**`server/tests/`**
- Purpose: Integration test fixtures and utilities
- Generated: No
- Committed: Yes

## Database Schema (Recaps)

**Tables:**
```sql
-- Recaps: Stores recap metadata
CREATE TABLE Recaps (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    Title VARCHAR(255) NOT NULL,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT NOT NULL,
    TotalMessageCount INT NOT NULL,
    Status VARCHAR(32) NOT NULL,
    ReadAt BIGINT DEFAULT 0 NOT NULL,
    BotID VARCHAR(26) DEFAULT '' NOT NULL
);

-- RecapChannels: Per-channel summary data
CREATE TABLE RecapChannels (
    Id VARCHAR(26) PRIMARY KEY,
    RecapId VARCHAR(26) NOT NULL,
    ChannelId VARCHAR(26) NOT NULL,
    ChannelName VARCHAR(64) NOT NULL,
    Highlights TEXT,         -- JSON array
    ActionItems TEXT,        -- JSON array
    SourcePostIds TEXT,      -- JSON array
    CreateAt BIGINT NOT NULL,
    FOREIGN KEY (RecapId) REFERENCES Recaps(Id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_recaps_user_id` - Query recaps by user
- `idx_recaps_user_id_delete_at` - Filter active recaps
- `idx_recaps_user_id_read_at` - Filter unread recaps
- `idx_recap_channels_recap_id` - Join channels to recap

---

*Structure analysis: 2026-01-21*
