# Mattermost Repository Architecture Guide

## Overview

Mattermost is an open-source, self-hosted collaboration platform written in **Go** (server) and **React** (web app). It runs as a single Linux binary and uses PostgreSQL for persistence. This document provides a comprehensive architectural overview for developers.

## Project Structure

### Top-Level Organization

```
mattermost/
├── server/          # Go backend server
├── webapp/          # React frontend (npm workspaces)
├── e2e-tests/       # End-to-end testing (Cypress, Playwright)
├── api/             # API documentation and specifications
├── tools/           # Development tools
└── [config files]   # Docker, Make, git configs
```

---

## Server Architecture (Go)

### Server Directory Structure

```
server/
├── cmd/
│   └── mattermost/
│       ├── main.go           # Entry point
│       └── commands/          # CLI command implementations
├── channels/                  # Core messaging and channels
│   ├── app/                   # Business logic (~231 .go files, 130k+ LOC)
│   ├── api4/                  # REST API v4 endpoints (~150 files)
│   ├── store/                 # Data access layer (interfaces & implementations)
│   ├── web/                   # Web handler setup (static files, auth, HTML)
│   ├── wsapi/                 # WebSocket API handlers
│   ├── jobs/                  # Background job system (~25 job types)
│   ├── audit/                 # Audit logging
│   ├── testlib/               # Testing utilities
│   └── utils/                 # Helper utilities
├── platform/                  # Shared platform services
│   ├── services/              # Telemetry, cache, image proxy, search, etc.
│   └── shared/                # File store, mail, templates
├── enterprise/                # Enterprise features (build-tagged)
├── einterfaces/               # Enterprise service interfaces
├── public/                    # Public APIs for plugins
│   ├── model/                 # Data models
│   ├── plugin/                # Plugin system and hooks
│   ├── pluginapi/             # Plugin API helpers
│   ├── shared/                # Shared utilities
│   └── utils/                 # Public utilities
├── config/                    # Configuration management
├── templates/                 # HTML templates
├── i18n/                      # Internationalization files
├── build/                     # Build scripts and artifacts
└── Makefile                   # Build targets
```

### Key Architectural Layers

#### 1. **HTTP Server & Routing**
- **Entry Point**: `server/cmd/mattermost/main.go`
  - Imports enterprise code via build tags
  - Invokes `commands.Run()` from the Cobra CLI framework
  
- **Server Setup**: `server/channels/app/server.go`
  - `Server` struct manages HTTP server, routers, and services
  - Three routers:
    - `RootRouter`: All HTTP requests
    - `LocalRouter`: Unix socket requests
    - `Router`: Web, API v4, and WebSocket requests

#### 2. **API Layer** (`server/channels/api4/`)
- **RESTful API v4** (and v5 in development)
- Organized by resource type:
  - Users, Teams, Channels, Posts, Files
  - Bots, Commands, Webhooks
  - Plugins, Reactions, Threads
  - Search, Audit, Settings
- **Routing**: Gorilla mux-based route definitions in `api.go`

#### 3. **Business Logic** (`server/channels/app/`)
- **Core Components**:
  - 200+ files implementing business logic
  - `App` struct: Request-scoped, provides business methods
  - `Server` struct: Long-lived, manages HTTP and services
  - `Channels` struct: Channels-specific state and handlers
  
- **Key Responsibilities**:
  - User management and authentication
  - Channel and team operations
  - Post creation and retrieval
  - Message search and indexing
  - File uploads and processing
  - Plugin lifecycle management
  - Job scheduling (15+ background jobs)

#### 4. **Data Access Layer** (`server/channels/store/`)
- **Store Interface Pattern**: Defines contracts for data access
- **Store Implementations**:
  - `sqlstore/`: PostgreSQL implementation (master/replica support)
  - `localcachelayer/`: In-memory caching layer
  - `retrylayer/`: Automatic retry logic
  - `searchlayer/`: Search integration (Elasticsearch)
  - `timerlayer/`: Performance metrics

- **Store Interfaces** (25+ stores):
  ```go
  Team()           // Teams
  Channel()        // Channels
  Post()           // Posts
  User()           // Users
  Bot()            // Bots
  Session()        // Sessions
  OAuth()          // OAuth tokens
  Plugin()         // Plugin metadata
  // ... and 15+ more
  ```

#### 5. **WebSocket API** (`server/channels/wsapi/`)
- Real-time bidirectional communication
- Message broadcasting
- User status updates
- Live collaboration features

#### 6. **Web Handler** (`server/channels/web/`)
- Static file serving
- OAuth/SAML authentication flows
- HTML template rendering
- Browser compatibility checks

#### 7. **Background Jobs** (`server/channels/jobs/`)
- **Job Types**:
  - Data export/import
  - Cleanup (orphan data, expired sessions)
  - Migrations (data schema updates)
  - Notifications (push, email, admin alerts)
  - Search indexing
  - Telemetry collection
  - Scheduled posts
- **Job Server**: Manages job scheduling and execution

---

## Enterprise vs Team Edition Organization

### Build Tag Strategy
The codebase supports multiple editions through Go build tags:

```
BUILD_TAGS = enterprise | sourceavailable | (empty for team edition)
```

### Enterprise Structure

#### `server/enterprise/` (Source-Available)
- Contains enterprise features under source-available license
- **External Imports** (`external_imports.go`):
  - Imports closed-source enterprise packages when available
  - Features:
    - Account migration
    - Compliance & data retention
    - LDAP, SAML, OAuth providers
    - Elasticsearch metrics
    - Cloud integration
    - IP filtering
    - Message export (multiple formats)

- **Local Imports** (`local_imports.go`):
  - Available in dev builds (BUILD_NUMBER=dev)
  - Source-available implementation

#### `server/einterfaces/` (Interface Definitions)
- Pure interfaces for enterprise features:
  - `LicenseInterface`: License management
  - `ComplianceInterface`: Compliance features
  - `LdapInterface`: LDAP integration
  - `DataRetentionInterface`: Data retention policies
  - `MetricsInterface`: Enterprise metrics
  - `SamlInterface`: SAML integration
  - `MessageExportInterface`: Message exports
  - `NotificationInterface`: Enterprise notifications
  - `AccessControlServiceInterface`: Advanced access control

- **Implementation Pattern**:
  ```go
  // In app/app.go
  func (a *App) Ldap() einterfaces.LdapInterface {
    return a.ch.Ldap  // Returns implementation or no-op
  }
  ```

### Feature Activation
- **Team Edition**: Interfaces return no-op implementations
- **Enterprise Edition**: Interfaces return actual implementations
- **Graceful Degradation**: Team edition features remain functional

---

## Webapp Architecture (React)

### Webapp Directory Structure

```
webapp/
├── channels/                 # Main Mattermost application
│   ├── src/
│   │   ├── components/       # 300+ React components
│   │   ├── actions/          # Redux action creators (~42 directories)
│   │   ├── selectors/        # Redux state selectors (~29 files)
│   │   ├── reducers/         # Redux state reducers
│   │   ├── hooks/            # Custom React hooks
│   │   ├── plugins/          # Plugin system integration
│   │   ├── client/           # HTTP client for API calls
│   │   ├── i18n/             # Internationalization (70+ languages)
│   │   ├── sass/             # Stylesheets
│   │   └── entry.tsx         # Application entry point
│   └── webpack.config.js     # Build configuration
│
├── platform/                 # Shared packages (npm workspaces)
│   ├── client/               # HTTP client utilities
│   ├── components/           # Reusable UI components
│   ├── mattermost-redux/     # State management (Redux store)
│   ├── types/                # TypeScript type definitions
│   └── eslint-plugin/        # ESLint custom rules
│
└── scripts/                  # Build and development scripts
```

### Technology Stack

- **Framework**: React 18+
- **State Management**: Redux + Redux Thunk
- **Styling**: SASS/SCSS
- **Build Tool**: Webpack 5
- **Package Manager**: npm workspaces
- **Language**: TypeScript
- **Testing**: Jest
- **Linting**: ESLint

### Component Organization

#### Component Categories
- **Layout Components**: App shell, sidebar, main content area
- **Modal Components**: Dialogs and popup windows (~50+ modals)
- **Admin Components**: System console, settings, user management
- **Channel Components**: Channel list, channel header, message display
- **Post Components**: Message rendering, reactions, threading
- **User Components**: Profiles, mentions, DMs

#### Redux Structure
- **Actions**: Dispatched to initiate state changes
- **Reducers**: Transform state based on actions
- **Selectors**: Extract data from state (performance optimized)
- **Middleware**: Async operations (Redux Thunk)

---

## Platform Services (`server/platform/`)

Shared services available across the application:

### `server/platform/services/`

- **`cache/`**: In-memory caching layer
- **`searchengine/`**: Elasticsearch integration broker
- **`imageproxy/`**: Image proxy for inline previews
- **`remotecluster/`**: Multi-cluster communication
- **`sharedchannel/`**: Cross-cluster channel sharing
- **`telemetry/`**: Analytics and usage metrics
- **`awsmeter/`**: AWS usage metering
- **`slackimport/`**: Slack workspace import
- **`marketplace/`**: Plugin marketplace integration
- **`upgrader/`**: Version upgrade handling

### `server/platform/shared/`

- **`filestore/`**: File storage abstraction (S3, local, etc.)
- **`mail/`**: Email sending service
- **`templates/`**: HTML template management

---

## Plugin System

### Plugin Architecture

#### Plugin Locations
- **Core Plugins**: `server/plugins/github/`, `server/plugins/zoom/`
- **Plugin Environment**: Managed in `server/channels/app/plugin.go`
- **Plugin API**: `server/public/plugin/`

#### Plugin Capabilities
- HTTP endpoints
- Slash commands
- Webhooks (incoming & outgoing)
- Message hooks (preprocessing, post-processing)
- Web app components (via `registerPlugin()`)
- Database access via stored procedures

#### Plugin Interfaces (`server/public/plugin/`)
- `Plugin`: Main plugin interface
- `Hooks`: Post lifecycle, user actions, team operations
- `API`: Access to app functionality

---

## Data Models (`server/public/model/`)

Core data structures used throughout the application:

```go
User           // Authenticated users
Team           // Team organization
Channel        // Conversation channels
Post           // Messages (text with attachments)
Reaction       // Emoji reactions on posts
Thread         // Reply threads
Session        // User sessions
OAuth          // OAuth integrations
Command        // Slash command definitions
Bot            // Bot accounts
FileInfo       // File metadata
Preference     // User preferences (UI settings, favorites)
License        // Enterprise license
Config         // Server configuration
```

---

## Request Flow Architecture

### Typical Request Lifecycle

```
1. HTTP Request
   ↓
2. Router (Gorilla mux)
   ├─ Route matching
   └─ Middleware (auth, logging, CORS)
   ↓
3. API Handler (api4/*.go)
   ├─ Parse input
   ├─ Validate request
   └─ Call App methods
   ↓
4. Business Logic (app/*.go)
   ├─ Authorization check
   ├─ Data validation
   ├─ Side effects (plugins, jobs)
   └─ Store interaction
   ↓
5. Data Access (store/)
   ├─ Cache check
   ├─ Query optimization
   ├─ Database operation
   └─ Cache update
   ↓
6. Response
   ├─ JSON serialization
   ├─ Error handling
   └─ HTTP response
```

### WebSocket Flow

```
1. HTTP Upgrade (websocket)
   ↓
2. WebSocket Handler (wsapi/)
   ├─ Connection establishment
   ├─ Authentication
   └─ User registration
   ↓
3. Message Routing
   ├─ Action type dispatch
   └─ Plugin hooks invoked
   ↓
4. Broadcasting
   ├─ User-specific messages
   └─ Cluster propagation
   ↓
5. Client Notification
```

---

## Configuration Management

### Configuration Layers

1. **Default Configuration** (`server/config/`)
   - Built-in defaults for all settings

2. **Environment Variables**
   - Override config via MM_* variables
   - Example: `MM_SERVICESETTINGS_SITEURL`

3. **Configuration File**
   - YAML format (`config.yaml`)
   - Location: `--config` flag or default location

4. **Admin Console Overrides**
   - Web UI for dynamic configuration
   - Persisted to database

### Configuration Structure
- `ServiceSettings`: HTTP server, rate limiting, session timeouts
- `TeamSettings`: Team-specific defaults
- `ClientRequirements`: Minimum client versions
- `LdapSettings`: LDAP integration
- `SamlSettings`: SAML integration
- `SqlSettings`: Database connection
- `PluginSettings`: Plugin configuration

---

## Build System

### Build Process

```
Makefile targets:
├── build          # Compile mattermost binary
├── package        # Create distributions (Linux, macOS, Windows)
├── test           # Run unit tests
├── test-client    # Run webapp tests
├── test-server    # Run server tests
├── vet            # Code analysis
├── check-style    # Lint checks
└── run            # Development server
```

### Build Tags

- **enterprise**: Full enterprise code
- **sourceavailable**: Source-available enterprise code
- **dev** (implicit): Development build with defaults

### Development Build

```bash
# From server/ directory
make build

# With specific configuration
make build BUILD_NUMBER=dev BUILD_DATE=...
```

---

## Testing Architecture

### Server Testing

- **Unit Tests**: `*_test.go` files parallel to source
- **Integration Tests**: `store/storetest/`, `channels/testlib/`
- **Test Database**: Automatic setup/teardown
- **Mocking**: Mockery for interface mocking

```bash
make test-server          # Run all tests
make test-server-quick    # Skip long-running tests
make test-server-race     # Race condition detection
```

### Webapp Testing

- **Jest Framework**: Unit and component tests
- **Testing Library**: Component testing utilities
- **Snapshot Tests**: Visual regression detection

```bash
npm test --workspace=channels   # Test channels workspace
npm test --workspaces           # Test all workspaces
```

### E2E Testing

```
e2e-tests/
├── cypress/          # Cypress browser automation tests
├── playwright/       # Playwright multi-browser tests
└── README.md         # Testing documentation
```

---

## Key Architectural Patterns

### 1. **Request-Scoped App Pattern**
```go
// App is constructed per-request
type App struct {
  ch *Channels  // Reference to shared state
}

// Server is long-lived
type Server struct {
  // Long-lived fields
  platform *platform.PlatformService
  Jobs     *jobs.JobServer
  // ...
}
```

### 2. **Store Interface Pattern**
- Abstracts database operations
- Enables caching and optimization layers
- Supports testing via mocks

### 3. **Service Dependency Injection**
- Services passed to handlers/repositories
- Explicit dependencies
- Testable architecture

### 4. **Enterprise Interface Pattern**
- Interfaces in `einterfaces/`
- Implementations vary by build tag
- No-op fallbacks for team edition

### 5. **Plugin Hook System**
- Register hooks at startup
- Async hook execution
- Multiple handlers per hook

### 6. **Redux State Management** (Frontend)
- Single source of truth
- Immutable updates
- Selectors for performance
- Middleware for async operations

---

## Important Files & Entry Points

### Server
- **Main Entry**: `server/cmd/mattermost/main.go`
- **Server Setup**: `server/channels/app/server.go`
- **App Initialization**: `server/channels/app/channels.go`, `server/channels/app/app.go`
- **API Routes**: `server/channels/api4/api.go`
- **Store Interface**: `server/channels/store/store.go`

### Webapp
- **Entry Point**: `webapp/channels/src/entry.tsx`
- **Root Component**: `webapp/channels/src/root.tsx`
- **Redux Store**: Setup in main app component
- **Actions**: `webapp/channels/src/actions/`
- **Selectors**: `webapp/channels/src/selectors/`

---

## Development Workflow

### Getting Started

1. **Server Development**
   ```bash
   cd server
   make run
   ```

2. **Webapp Development**
   ```bash
   cd webapp
   npm run dev-server
   ```

3. **Full Stack with Docker**
   ```bash
   make start-docker
   ```

### Common Tasks

- **Add a New API Endpoint**: 
  - Add route in `server/channels/api4/api.go`
  - Implement handler
  - Add business logic in `server/channels/app/`
  - Add store methods if needed

- **Add a New Database Table**:
  - Create migration in `server/build/migrations/`
  - Add store interface in `server/channels/store/`
  - Implement in `server/channels/store/sqlstore/`

- **Add a React Component**:
  - Create component file in `webapp/channels/src/components/`
  - Add Redux actions/selectors if needed
  - Import and use in parent component

---

## Performance Considerations

### Server-Side
- **Caching Layers**: Local cache, Redis integration
- **Query Optimization**: Prepared statements, batch operations
- **Connection Pooling**: Database connection management
- **Rate Limiting**: Per-user and global limits

### Webapp-Side
- **Code Splitting**: Route-based and component-based splitting
- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo, useMemo hooks
- **Redux Selectors**: Prevent unnecessary re-renders

---

## Security Architecture

### Server-Side
- **Authentication**: Session-based, OAuth, SAML, LDAP
- **Authorization**: Role-based access control (RBAC)
- **Plugin Sandboxing**: Plugins run in isolated processes
- **Input Validation**: All API inputs validated
- **HTTPS/TLS**: Full encryption support

### Webapp-Side
- **CSRF Protection**: Token-based validation
- **XSS Prevention**: Template escaping, Content Security Policy
- **Secure Storage**: Session storage, secure cookies
- **API Security**: Signed requests

---

## Cluster Architecture

### Multi-Instance Deployment
- **Message Broker**: For cluster communication
- **Remote Clusters**: Federated instances
- **Shared Channels**: Cross-cluster collaboration
- **Session Management**: Distributed sessions

### Services
- `server/platform/services/remotecluster/`
- `server/platform/services/sharedchannel/`

---

## Version Information

- **Go Version**: See `server/.go-version`
- **Node Version**: Node >= 18.10.0, npm 9+ or 10+
- **TypeScript**: 5.6.3
- **React**: 18+
- **Webpack**: 5.95.0

---

## Documentation Resources

- **Official Docs**: https://docs.mattermost.com
- **Developer Docs**: https://developers.mattermost.com
- **API Documentation**: https://api.mattermost.com
- **Contributing Guide**: `CONTRIBUTING.md`

---

## Common Code Patterns

### Accessing Current User (Server)
```go
userId := c.Session.UserId
```

### Store Operations
```go
user, err := a.Srv().Store().User().Get(ctx, userId)
```

### App Method Pattern
```go
func (a *App) CreatePost(c *request.Context, post *model.Post) (*model.Post, *model.AppError) {
  // Validation
  // Authorization
  // Store interaction
  // Plugin hooks
  return savedPost, nil
}
```

### Redux Dispatch (Frontend)
```tsx
dispatch(fetchUser(userId));
dispatch(selectChannel(channelId));
```

### Selector Usage
```tsx
const user = useSelector(getCurrentUser);
const team = useSelector(getTeam);
```

---

## Notes for Contributors

1. **Code Organization**: Follow existing package structure
2. **Testing**: Write tests for new functionality
3. **Documentation**: Update docs and ADRs for architectural changes
4. **Build Tags**: Use `enterprise` tag for enterprise features
5. **Performance**: Profile and optimize hot paths
6. **Security**: Run security scans before PR submission
7. **Plugin Compatibility**: Maintain backward compatibility with plugins

---

## Monorepo Structure Benefits

- **Unified Testing**: Single test suite for entire application
- **Shared Dependencies**: Coordinated dependency updates
- **Consistent Versioning**: Single version number for all components
- **Integrated CI/CD**: Coordinated release process
- **Plugin Development**: Example plugins in same repo

---

