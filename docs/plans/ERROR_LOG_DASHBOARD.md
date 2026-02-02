Error Log Dashboard Implementation Plan

Overview

Create a beautiful, real-time error logging dashboard under Mattermost Extended in the System Console. System admins can view API errors (server-side) and JavaScript errors (client-side)  
from all users in real-time.

Architecture

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  JS Errors      │     │  API Errors     │     │  Admin Console  │
│  (Browser)      │     │  (Server)       │     │  Dashboard      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
        │                       │                       │
        │ POST /errors          │ Internal              │ GET /errors
        ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────┐
    │                    Error Log API                         │
    │               (server/channels/api4/error_log.go)        │
    └────────────────────────────┬────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
    ┌─────────┐           ┌─────────────┐         ┌─────────────┐
    │ Database │           │  WebSocket  │         │   In-Memory │
    │ Storage  │           │  Broadcast  │         │   Buffer    │
    │(optional)│           │ (to admins) │         │ (last 1000) │
    └─────────┘           └─────────────┘         └─────────────┘

Feature Flag

Add new feature flag: ErrorLogDashboard
- Default: false
- Environment: MM_FEATUREFLAGS_ERRORLOGDASHBOARD=true

---
Server-Side Implementation

1. Error Log Model

File: server/public/model/error_log.go

type ErrorLog struct {
    Id           string `json:"id"`
    CreateAt     int64  `json:"create_at"`
    Type         string `json:"type"`          // "api" or "js"
    UserId       string `json:"user_id"`
    Username     string `json:"username"`
    Message      string `json:"message"`
    Stack        string `json:"stack"`
    Url          string `json:"url"`
    UserAgent    string `json:"user_agent"`
    StatusCode   int    `json:"status_code"`   // For API errors
    Endpoint     string `json:"endpoint"`      // For API errors
    Method       string `json:"method"`        // For API errors
    ComponentStack string `json:"component_stack"` // For React errors
    Extra        string `json:"extra"`         // JSON metadata
}

2. In-Memory Ring Buffer

File: server/channels/app/error_log_buffer.go

- Circular buffer holding last 1000 errors
- Thread-safe with mutex
- No database required (keeps it simple)
- Errors expire/rotate naturally

3. WebSocket Event

File: server/public/model/websocket_message.go

Add new event type:
WebsocketEventErrorLogged WebsocketEventType = "error_logged"

Broadcast with ContainsSensitiveData: true (admin-only).

4. API Endpoints

File: server/channels/api4/error_log.go
┌────────┬────────────────┬───────────────┬───────────────────────────┐
│ Method │    Endpoint    │  Permission   │        Description        │
├────────┼────────────────┼───────────────┼───────────────────────────┤
│ POST   │ /api/v4/errors │ Authenticated │ Submit error (JS clients) │
├────────┼────────────────┼───────────────┼───────────────────────────┤
│ GET    │ /api/v4/errors │ System Admin  │ Get all errors            │
├────────┼────────────────┼───────────────┼───────────────────────────┤
│ DELETE │ /api/v4/errors │ System Admin  │ Clear error buffer        │
└────────┴────────────────┴───────────────┴───────────────────────────┘
5. Server-Side Error Capture (Optional Enhancement)

Modify web.go or use middleware to capture API errors with status >= 500.

---
Client-Side Implementation

1. JavaScript Error Capture

File: webapp/channels/src/utils/error_reporter.ts

export function initErrorReporter() {
    // Global error handler
    window.addEventListener('error', (event) => {
        reportError({
            type: 'js',
            message: event.message,
            stack: event.error?.stack,
            url: event.filename,
            line: event.lineno,
            column: event.colno,
        });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        reportError({
            type: 'js',
            message: event.reason?.message || String(event.reason),
            stack: event.reason?.stack,
        });
    });
}

async function reportError(error: ErrorReport) {
    await Client4.reportError(error);
}

2. React Error Boundary Enhancement

File: webapp/channels/src/components/error_boundary.tsx

Enhance existing error boundary to report errors to the server.

3. Client4 API Method

File: webapp/platform/client/src/client4.ts

reportError = (error: ErrorReport) => {
    return this.doFetch<void>(
        `${this.getBaseRoute()}/errors`,
        {method: 'post', body: JSON.stringify(error)}
    );
};

4. WebSocket Handler

File: webapp/channels/src/actions/websocket_actions.jsx

Add handler for error_logged event to update Redux store.

5. Redux State

File: webapp/channels/src/reducers/views/error_logs.ts

interface ErrorLogsState {
    items: ErrorLog[];
    loading: boolean;
}

---
Admin Console Dashboard

1. Register in Admin Definition

File: webapp/channels/src/components/admin_console/admin_definition.tsx

Add under mattermost_extended.subsections:
error_logs: {
    url: 'mattermost_extended/error_logs',
    title: defineMessage({id: 'admin.sidebar.error_logs', defaultMessage: 'Error Logs'}),
    isHidden: it.not(it.configIsTrue('FeatureFlags', 'ErrorLogDashboard')),
    schema: {
        id: 'ErrorLogDashboard',
        component: ErrorLogDashboard,
    },
},

2. Dashboard Component

File: webapp/channels/src/components/admin_console/error_log_dashboard/

error_log_dashboard/
├── index.ts
├── error_log_dashboard.tsx      # Main dashboard
├── error_log_dashboard.scss     # Styles
├── error_log_list.tsx           # Error list component
├── error_log_item.tsx           # Individual error card
├── error_log_filters.tsx        # Filter controls
└── error_log_stats.tsx          # Summary statistics

3. Dashboard UI Design

┌─────────────────────────────────────────────────────────────────┐
│  Error Logs                                          [Clear All]│
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 24       │  │ 18       │  │ 6        │  │ ● Live           │ │
│  │ Total    │  │ API      │  │ JS       │  │   Real-time      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [API ▼] [JS ▼]  Search: [____________]         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔴 API Error                              2 seconds ago     ││
│  │ POST /api/v4/posts - 500 Internal Server Error              ││
│  │ User: john.doe                                              ││
│  │ ┌─ Stack trace ──────────────────────────────────────────┐  ││
│  │ │ Error: Database connection failed                       │ ││
│  │ │   at SqlPostStore.Save (post_store.go:145)             │ ││
│  │ │   at App.CreatePost (post.go:89)                       │ ││
│  │ └────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟡 JS Error                               15 seconds ago    ││
│  │ TypeError: Cannot read property 'id' of undefined           ││
│  │ User: jane.smith                                            ││
│  │ URL: /channels/town-square                                  ││
│  │ [Show Stack Trace]                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘

4. Features

- Real-time updates - New errors appear instantly via WebSocket
- Filtering - Filter by type (API/JS), time range, user
- Search - Search by message, stack trace, or user
- Expandable stack traces - Click to expand/collapse
- Statistics cards - Total, API, JS counts
- Live indicator - Shows when connected and receiving updates
- Clear all - Admin can clear the buffer
- Time display - Relative time (e.g., "2 seconds ago")

---
Files to Create/Modify

Server (Create)

1. server/public/model/error_log.go - Model
2. server/channels/app/error_log_buffer.go - In-memory storage
3. server/channels/api4/error_log.go - API endpoints

Server (Modify)

4. server/public/model/websocket_message.go - Add event type
5. server/public/model/feature_flags.go - Add feature flag
6. server/channels/api4/api.go - Register routes

Webapp (Create)

7. webapp/channels/src/utils/error_reporter.ts - Error capture
8. webapp/channels/src/reducers/views/error_logs.ts - Redux state
9. webapp/channels/src/components/admin_console/error_log_dashboard/ - Dashboard UI (multiple files)

Webapp (Modify)

10. webapp/platform/client/src/client4.ts - Add reportError method
11. webapp/channels/src/utils/constants.tsx - Add WebSocket event
12. webapp/channels/src/actions/websocket_actions.jsx - Handle event
13. webapp/channels/src/components/admin_console/admin_definition.tsx - Register page
14. webapp/channels/src/components/admin_console/mattermost_extended_features.tsx - Add flag

---
Implementation Order

1. Server: Core infrastructure
- Feature flag
- Model
- In-memory buffer
- API endpoints
- WebSocket event
2. Webapp: Error capture
- Error reporter utility
- Client4 method
- Initialize in app
3. Webapp: Dashboard
- Redux state
- WebSocket handler
- Dashboard component
- Admin definition registration
4. Testing
- Enable feature flag
- Trigger errors
- Verify real-time updates

---
Verification

1. Enable feature flag: MM_FEATUREFLAGS_ERRORLOGDASHBOARD=true
2. Navigate to System Console → Mattermost Extended → Error Logs
3. Open browser console and throw an error: throw new Error('Test error')
4. Verify error appears in dashboard in real-time
5. Make an API call that fails (e.g., invalid endpoint)
6. Verify API error appears in dashboard
7. Test filter and search functionality
8. Test clear all functionality