# AGENTS.md - Architect Mode

This file provides architectural guidance for agents working in Architect mode in this repository.

## System Architecture

### High-Level Components
```
┌─────────────┐      HTTP/WebSocket      ┌─────────────────┐
│   Webapp    │ ◄──────────────────────► │  Server (Go)    │
│  (React)    │                         │  - REST API     │
│             │                         │  - WebSocket    │
└─────────────┘                         │  - Business     │
                                        │    Logic        │
                                        └────────┬────────┘
                                                 │
                    ┌─────────────┬──────────────┼─────────────┐
                    ▼             ▼              ▼             ▼
              ┌─────────┐   ┌──────────┐   ┌──────────┐  ┌──────────┐
              │ MySQL   │   │PostgreSQL│   │  MinIO   │  │Elasticsearch│
              │ /       │   │          │   │ (Files)  │  │ (Search) │
              │Postgres │   │          │   │          │  │          │
              └─────────┘   └──────────┘   └──────────┘  └──────────┘
```

### Server Architecture Layers

```
┌─────────────────────────────────────────┐
│           API Handlers (api4)           │
│     (HTTP routing, auth, validation)    │
├─────────────────────────────────────────┤
│              App Layer                  │
│       (Business logic, workflows)       │
├─────────────────────────────────────────┤
│            Store Layer                  │
│    (Database abstraction, caching)      │
├─────────────────────────────────────────┤
│         Platform Services               │
│  (Notifications, search, jobs, etc.)    │
└─────────────────────────────────────────┘
```

## Key Architectural Patterns

### Request Flow
1. **HTTP Request** → `api4/` handler
2. **Authentication** → Session middleware
3. **Permission Check** → `app.HasPermissionTo*`
4. **Business Logic** → `app/` layer
5. **Data Access** → `store/` layer
6. **Response** → JSON serialization

### Store Layer Design
- **Interfaces defined in** `channels/store/store.go`
- **Implementations** in `channels/store/sqlstore/`
- **Layer generators** create:
  - Caching layer (`channels/store/localcachelayer/`)
  - Metrics layer
  - OpenTracing layer
- **Mocks** auto-generated in `channels/store/storetest/mocks/`

### Plugin Architecture
- **Public API** in `server/public/plugin/`
- **Hooks interface** for plugin lifecycle
- **API interface** for server interaction
- Uses RPC for plugin isolation

## Data Flow

### Real-time Messaging
```
Client ──WebSocket──► Server ──Pub/Sub──► Other Clients
                          │
                          ▼
                    Persistent Store
```

### File Upload
```
Client ──HTTP──► Server ──Store──► MinIO/S3/Local
```

### Search Indexing
```
Document ──Index──► Elasticsearch
     │
     └───Store──► Database
```

## Scaling Considerations

### Horizontal Scaling
- **Stateless API servers** - can run multiple instances
- **WebSocket hub** - clustered via Redis (enterprise)
- **Database** - read replicas supported
- **File storage** - S3-compatible (MinIO)

### Background Jobs
- **Job server** in `channels/jobs/`
- Supports worker pools
- Implements job scheduling and retry logic

## Enterprise Features

### Architecture
- Enterprise code in separate repository (`../enterprise`)
- Compile-time integration via build tags
- Same interfaces, different implementations

### Enterprise Components
- SAML/LDAP authentication
- Advanced compliance
- Elasticsearch integration
- High availability clustering
- Advanced permissions (custom roles)

## Webapp Architecture

### Frontend Stack
- **React 17** with class and functional components
- **Redux** for state management
- **React-Redux** with hooks
- **React Intl** for i18n
- **React Router** for navigation

### State Management Pattern
```
Action ──► Reducer ──► Store ──► Selector ──► Component
   ▲                                          │
   └──────────────Dispatch────────────────────┘
```

### Module Organization
- `actions/` - Redux action creators (thunks)
- `reducers/` - Redux reducers
- `selectors/` - Memoized state selectors
- `components/` - React components
- `utils/` - Utility functions
- `client/` - API client

## Security Model

### Authentication
- Session-based (cookie + token)
- OAuth 2.0 for third-party apps
- SAML 2.0 (enterprise)
- LDAP (enterprise)

### Authorization
- Role-based access control (RBAC)
- Permission system in `model/permission.go`
- Channel/team-scoped permissions

## Deployment Architecture

### Docker Compose (Development)
```yaml
services:
  - mysql/postgres  # Database
  - minio           # File storage
  - inbucket        # Email testing
  - openldap        # LDAP testing
  - elasticsearch   # Search (enterprise)
```

### Binary Distribution
- Single Go binary + static files
- Cross-platform: Linux, macOS, Windows
- ARM64 and AMD64 support

## Extension Points

### Plugins
- Full server API access
- Custom webapp components
- Independent lifecycle
- Marketplace integration

### Integrations
- **Incoming webhooks** - POST to channels
- **Outgoing webhooks** - HTTP callbacks
- **Slash commands** - Custom commands
- **Apps** - Interactive workflows

## Performance Considerations

### Caching Strategy
- In-memory LRU cache for hot data
- Redis for distributed caching (enterprise)
- Database query caching at store layer

### Database Optimization
- Connection pooling
- Prepared statements
- Query builders (squirrel)
- Index optimization

### Frontend Optimization
- Code splitting
- Lazy loading
- Service worker for caching
- Image optimization
