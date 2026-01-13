# Architecture

**Analysis Date:** 2026-01-13

## Pattern Overview

**Overall:** Layered Monolith (Go Backend + React Frontend)

**Key Characteristics:**
- Request-scoped application service pattern (`App` struct per request)
- Clean separation between HTTP handling, business logic, and data access
- Plugin architecture for extensibility
- Real-time WebSocket communication alongside REST API
- Multi-database support (PostgreSQL, MySQL, SQLite)

## Layers

**HTTP/Router Layer:**
- Purpose: Handle incoming HTTP requests, routing, and response formatting
- Contains: Route definitions, middleware, request/response handlers
- Location: `server/channels/api4/` (REST API v4), `server/channels/web/` (web handlers)
- Depends on: Application layer
- Used by: External clients, web browsers

**Application/Business Logic Layer:**
- Purpose: Core domain logic, business rules, and orchestration
- Contains: User management, channel operations, post handling, team management, authentication, plugins
- Location: `server/channels/app/` (~247 Go files)
- Depends on: Store layer, platform services
- Used by: API handlers

**Data Access/Store Layer:**
- Purpose: Database abstraction, caching, search integration
- Contains: Store interfaces, SQL implementations, cache wrappers, retry logic
- Location: `server/channels/store/` (interfaces), `server/channels/store/sqlstore/` (SQL impl)
- Depends on: Database drivers, cache services
- Used by: Application layer

**Platform Services Layer:**
- Purpose: Cross-cutting infrastructure services
- Contains: Search engine, caching, telemetry, image proxy, marketplace integration
- Location: `server/platform/services/`
- Depends on: External services (Redis, Elasticsearch)
- Used by: Application layer, Store layer

**Frontend UI Layer:**
- Purpose: User interface and client-side logic
- Contains: React components, Redux state management, API client
- Location: `webapp/channels/src/`
- Depends on: Backend REST API and WebSocket
- Used by: End users via browser

## Data Flow

**HTTP Request (REST API):**

1. Request → `Server.RootRouter` (Gorilla mux) - `server/channels/app/server.go`
2. Router matches path → `api4.APIHandler` or `web.Handler`
3. `web.Context` created with user session and request data
4. Handler extracts parameters, validates input
5. Handler calls `App` methods (e.g., `a.GetUser()`)
6. `App` delegates to domain-specific logic files
7. Data access via `Store()` interfaces → SQL/Cache layers
8. Response marshalled as JSON and returned to client

**WebSocket Event:**

1. Client connects → `/api/v4/websocket`
2. `Server.WebSocketRouter` handles connection - `server/channels/app/web_hub.go`
3. Events broadcast to relevant users/channels
4. Real-time updates for typing, posts, presence

**Frontend Request Flow:**

1. React component dispatches Redux action - `webapp/channels/src/actions/`
2. Async thunk calls API client method - `webapp/platform/client/src/client4.ts`
3. HTTP request to Go backend
4. Response updates Redux store - `webapp/channels/src/reducers/`
5. Components re-render based on state changes via selectors

**State Management:**
- Backend: Stateless per-request (database is source of truth)
- Frontend: Redux store with persistence (redux-persist)
- Sessions: Database-backed with optional Redis for clustering
- Real-time: WebSocket hub maintains active connections

## Key Abstractions

**App (Application Service):**
- Purpose: Request-scoped service containing business logic
- Examples: `server/channels/app/user.go`, `server/channels/app/channel.go`, `server/channels/app/post.go`
- Pattern: Methods like `(a *App) GetUser()`, `(a *App) CreatePost()`
- Location: `server/channels/app/app.go` - struct definition

**Store (Data Access Interface):**
- Purpose: Abstract database operations from business logic
- Examples: `UserStore`, `ChannelStore`, `PostStore`, `TeamStore`
- Pattern: Interface-based with multiple implementations (SQL, cache, search, retry layers)
- Location: `server/channels/store/store.go` - interface definitions

**Handler (HTTP Handler):**
- Purpose: HTTP request handling with middleware chain
- Examples: `server/channels/api4/user.go`, `server/channels/api4/channel.go`
- Pattern: `func (api *API) getUser(c *Context, w http.ResponseWriter, r *http.Request)`
- Location: `server/channels/api4/handlers.go` - handler utilities

**Job (Background Processing):**
- Purpose: Asynchronous task execution
- Examples: `export_process`, `import_process`, `cleanup_*`, `active_users`
- Pattern: Job struct implementing scheduler interface
- Location: `server/channels/jobs/` (~30+ job types)

**Redux Action/Thunk (Frontend):**
- Purpose: Async operations and state updates
- Examples: `webapp/channels/src/actions/channel_actions.ts`, `user_actions.ts`
- Pattern: Returns `{data: ...}` or `{error: ...}`
- Location: `webapp/channels/src/actions/`

**Selector (Frontend State Query):**
- Purpose: Memoized state queries
- Examples: `webapp/channels/src/selectors/`
- Pattern: `createSelector` for memoization, `makeGet*` factories
- Location: `webapp/channels/src/selectors/`

## Entry Points

**Server Entry:**
- Location: `server/cmd/mattermost/main.go`
- Triggers: `go run ./cmd/mattermost` or compiled binary
- Responsibilities: Initialize CLI, register commands, start server

**Server Command:**
- Location: `server/cmd/mattermost/commands/server.go`
- Triggers: `mattermost server` command
- Responsibilities: Configure and start HTTP server, initialize services

**CLI Tool (mmctl):**
- Location: `server/cmd/mmctl/mmctl.go`
- Triggers: `mmctl <command>` for administration
- Responsibilities: Remote server management, bulk operations

**Frontend Entry:**
- Location: `webapp/channels/src/entry.tsx` (app init), `webapp/channels/src/root.tsx` (webpack root)
- Triggers: Browser page load
- Responsibilities: Initialize React, Redux store, API client, render app

## Error Handling

**Strategy:** Throw/return errors, catch at boundaries, log with context

**Patterns:**
- Backend: Return `*model.AppError` for business errors, Go `error` for system errors
- Custom error type: `model.AppError` with status code, message, details
- Error logging: Structured logs with request context before returning
- Frontend: Redux actions return `{error: ServerError}`, UI displays error messages

**Error Flow:**
1. Store layer returns Go `error` for DB issues
2. App layer converts to `*model.AppError` with business context
3. API handler logs error, returns appropriate HTTP status
4. Client receives structured error response

## Cross-Cutting Concerns

**Logging:**
- Backend: `github.com/mattermost/logr/v2` structured logging - `server/platform/shared/mlog/`
- Frontend: Console logging in development
- Format: JSON structured with request ID, user ID, operation context

**Validation:**
- Backend: Model validation methods (e.g., `model.User.IsValid()`)
- API: Input validation in handlers before calling App methods
- Frontend: Form validation before API calls

**Authentication:**
- Backend: Session-based with JWT tokens - `server/channels/app/authentication.go`
- Middleware: Auth check on protected API routes - `server/channels/api4/api.go`
- Frontend: Token stored in cookies, refreshed automatically

**Authorization:**
- Backend: Permission checks via `app.HasPermissionTo*()` methods
- Roles: System admin, team admin, channel admin, user
- Schemes: Custom permission schemes for teams/channels

**Caching:**
- Local cache layer: `server/channels/store/localcachelayer/`
- Redis (optional): Session cache, cluster pub/sub
- Frontend: Redux store persistence

**Internationalization:**
- Backend: `github.com/mattermost/go-i18n` - `server/i18n/`
- Frontend: `react-intl` with `FormattedMessage` components

---

*Architecture analysis: 2026-01-13*
*Update when major patterns change*
