# Architecture

**Analysis Date:** 2026-01-21

## Pattern Overview

**Overall:** Modular Monolith with Client-Server Architecture

**Key Characteristics:**
- Go backend with layered architecture (API → App → Store)
- React/Redux frontend with feature-based organization
- Background job system for async processing
- WebSocket for real-time updates
- Plugin architecture for extensibility
- Enterprise features via interface injection

## Layers

**API Layer (REST/HTTP):**
- Purpose: HTTP request handling, routing, authentication, validation
- Location: `server/channels/api4/`
- Contains: Route handlers, middleware, request/response encoding
- Depends on: App layer, model types
- Used by: External clients, webapp

**App Layer (Business Logic):**
- Purpose: Core business logic, orchestration, cross-cutting concerns
- Location: `server/channels/app/`
- Contains: Domain services, feature implementations, job creation
- Depends on: Store layer, einterfaces, public model
- Used by: API layer, jobs, plugins

**Store Layer (Data Access):**
- Purpose: Database operations, data persistence, queries
- Location: `server/channels/store/sqlstore/`
- Contains: SQL implementations, migrations, query builders
- Depends on: Public model types
- Used by: App layer, jobs

**Jobs Layer (Background Processing):**
- Purpose: Async task execution, scheduled work, long-running operations
- Location: `server/channels/jobs/`
- Contains: Job workers, schedulers, job type definitions
- Depends on: Store layer, App layer (via interfaces)
- Used by: Server (registered at startup)

**Platform Layer (Infrastructure):**
- Purpose: Core platform services (sessions, config, cluster, websocket)
- Location: `server/channels/app/platform/`
- Contains: Service implementations, websocket hub, cluster coordination
- Depends on: Store layer, config
- Used by: App layer, Server

**Model Layer (Shared Types):**
- Purpose: Data structures, constants, validation, shared across layers
- Location: `server/public/model/`
- Contains: Structs, enums, request/response types, constants
- Depends on: Nothing (leaf dependency)
- Used by: All layers

**Frontend Redux Layer:**
- Purpose: State management, API calls, data normalization
- Location: `webapp/channels/src/packages/mattermost-redux/src/`
- Contains: Actions, reducers, selectors, action types
- Depends on: Client4 API client, types
- Used by: React components

**Frontend Components Layer:**
- Purpose: UI rendering, user interaction, feature presentation
- Location: `webapp/channels/src/components/`
- Contains: React components, styles, component-specific logic
- Depends on: Redux store, actions, selectors
- Used by: App routing, other components

## Data Flow

**API Request Flow:**

1. HTTP request hits `server/channels/api4/` router
2. Middleware chain: auth, rate limiting, context setup
3. Handler validates input, calls App layer method
4. App layer executes business logic, calls Store
5. Store performs database operation via SqlStore
6. Response bubbles back up through layers

**Background Job Flow:**

1. App layer creates job via `a.CreateJob()`
2. Job persisted to `Jobs` table with `Type` and `Data`
3. JobServer picks up pending job
4. Worker (e.g., `server/channels/jobs/recap/worker.go`) processes job
5. Worker updates job status, may publish WebSocket events

**Frontend State Flow:**

1. Component dispatches action (e.g., `createRecap()`)
2. Action calls `Client4` method to make API request
3. On success, dispatches `RECEIVED_*` action with data
4. Reducer updates normalized state in store
5. Selector derives view-specific data for component
6. Component re-renders with new props

**Recaps Feature Flow:**

1. User clicks "Add Recap" → Opens `CreateRecapModal`
2. Modal dispatches `createRecap(title, channelIds, agentId)`
3. API handler `createRecap()` in `server/channels/api4/recap.go`
4. App method `CreateRecap()` validates permissions, saves recap record
5. Background job created with type `model.JobTypeRecap`
6. Job worker `server/channels/jobs/recap/worker.go` processes channels
7. For each channel: fetches posts, calls AI summarization via bridge client
8. Saves `RecapChannel` records with highlights/action items
9. Publishes `WebsocketEventRecapUpdated` to notify frontend
10. Frontend receives update, fetches fresh recap data, displays results

**State Management:**
- Server: Stateless request handling, database as source of truth
- Client: Redux store with normalized entities, persisted via localforage
- Real-time: WebSocket events trigger state updates

## Key Abstractions

**App Interface:**
- Purpose: Exposes all business operations to API and other consumers
- Examples: `server/channels/app/recap.go`, `server/channels/app/channel.go`
- Pattern: Methods on `*App` struct, returns model types + `*model.AppError`

**Store Interface:**
- Purpose: Data access contract, enables testing with mocks
- Examples: `server/channels/store/store.go` defines all store interfaces
- Pattern: Interface per domain (e.g., `RecapStore`, `ChannelStore`)

**Job Worker:**
- Purpose: Background task execution with progress tracking
- Examples: `server/channels/jobs/recap/worker.go`
- Pattern: `MakeWorker()` returns `*jobs.SimpleWorker` with execute function

**Redux Action Creators:**
- Purpose: Async operations with standardized request/success/failure flow
- Examples: `webapp/channels/src/packages/mattermost-redux/src/actions/recaps.ts`
- Pattern: `bindClientFunc()` for CRUD, manual dispatch for complex flows

**Client4:**
- Purpose: Type-safe HTTP client for all API endpoints
- Examples: `webapp/platform/client/src/client4.ts`
- Pattern: Methods per endpoint, returns typed promises

## Entry Points

**Server Entry:**
- Location: `server/cmd/mattermost/main.go`
- Triggers: CLI execution (`mattermost server`)
- Responsibilities: Initialize commands, start server

**Server HTTP:**
- Location: `server/channels/app/server.go` → `Server` struct
- Triggers: HTTP requests on configured port
- Responsibilities: Routing, middleware, API serving

**API Routes:**
- Location: `server/channels/api4/api.go` → `Init()` function
- Triggers: Server startup
- Responsibilities: Register all route handlers on router

**Recap API:**
- Location: `server/channels/api4/recap.go` → `InitRecap()`
- Triggers: Called by `api.go` during route registration
- Responsibilities: Register recap endpoints at `/api/v4/recaps`

**Webapp Entry:**
- Location: `webapp/channels/src/entry.tsx`
- Triggers: Browser loads application
- Responsibilities: Initialize React app, configure store, mount root

**Redux Store:**
- Location: `webapp/channels/src/store/index.ts`
- Triggers: App initialization
- Responsibilities: Configure reducers, persistence, middleware

## Error Handling

**Strategy:** Typed error wrapping with HTTP status codes

**Server Patterns:**
- `*model.AppError` for all business errors
- `model.NewAppError(location, id, params, details, statusCode)`
- Errors wrapped with context: `.Wrap(err)`
- Store errors converted to `store.NewErrNotFound()` etc.

**Client Patterns:**
- Actions dispatch `*_FAILURE` on error
- `forceLogoutIfNecessary()` handles auth errors
- Components display error state from redux

**Recap Error Handling:**
```go
// App layer returns typed errors
if ok, _ := a.HasPermissionToChannel(...); !ok {
    return nil, model.NewAppError("CreateRecap", "app.recap.permission_denied", nil, "", http.StatusForbidden)
}

// Store errors wrapped with context
if err := a.Srv().Store().Recap().SaveRecap(recap); err != nil {
    return nil, model.NewAppError("CreateRecap", "app.recap.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
}
```

## Cross-Cutting Concerns

**Logging:**
- Logger obtained from request context: `rctx.Logger()`
- Structured logging with `mlog.String()`, `mlog.Int()`, `mlog.Err()`
- Log levels: Debug, Info, Warn, Error

**Validation:**
- API layer: `c.SetInvalidParam()` for request validation
- App layer: Permission checks via `HasPermissionTo*()` methods
- Model layer: `IsValid()` methods on structs

**Authentication:**
- Session-based auth, token in header or cookie
- `api.APISessionRequired()` middleware wrapper
- Session accessed via `rctx.Session()`

**Audit Logging:**
- `c.MakeAuditRecord()` creates audit record
- `auditRec.Success()` / `auditRec.AddEventPriorState()`
- Audit events defined in `server/public/model/audit_events.go`

**Feature Flags:**
- Defined in `server/public/model/feature_flags.go`
- Checked via `c.App.Config().FeatureFlags.EnableAIRecaps`
- Frontend: `useGetFeatureFlagValue('EnableAIRecaps')`

---

*Architecture analysis: 2026-01-21*
