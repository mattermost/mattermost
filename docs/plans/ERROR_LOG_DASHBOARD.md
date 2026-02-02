Error Log Dashboard Implementation Plan

Overview

Create a beautiful, intuitive, and informative real-time error logging dashboard under Mattermost Extended in the System Console. System admins can view API errors (server-side) and       
JavaScript errors (client-side) from all users in real-time.

Design Philosophy

Beautiful

- Modern card-based layout with subtle shadows and rounded corners
- Compass-icons throughout for consistency with Mattermost design language
- Color-coded severity indicators (red for errors, yellow for warnings)
- Smooth animations for new errors appearing
- Clean typography with proper hierarchy

Intuitive

- Zero-learning-curve interface - immediately understandable
- Expandable stack traces (collapsed by default to reduce noise)
- Smart filtering that remembers preferences
- Relative timestamps ("2 seconds ago") that update live
- Clear visual distinction between API and JS errors

Informative

- At-a-glance statistics cards showing error counts
- Live connection indicator
- Rich error details: user, URL, timestamp, stack trace
- Contextual information (endpoint, method, status code for API errors)
- Component stack for React errors

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

Feature Flag & Visibility

Approach: Tab is always visible in System Console. Contains an enable/disable toggle.

Add new feature flag: ErrorLogDashboard
- Default: false
- Environment: MM_FEATUREFLAGS_ERRORLOGDASHBOARD=true

When disabled: Dashboard shows a nice promotional card:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              🔍  Error Log Dashboard                            │
│                                                                 │
│   Monitor API and JavaScript errors from all users in          │
│   real-time. Quickly identify and debug issues affecting       │
│   your users.                                                   │
│                                                                 │
│   Features:                                                     │
│   • Real-time error streaming via WebSocket                     │
│   • Filter by error type, user, or search term                  │
│   • Expandable stack traces                                     │
│   • No database storage - lightweight in-memory buffer          │
│                                                                 │
│                    [ Enable Error Logging ]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

When enabled: Full dashboard with a toggle to disable at the top.

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
    // Always visible - component handles enabled/disabled state internally
    schema: {
        id: 'ErrorLogDashboard',
        component: ErrorLogDashboard,
    },
},

The component itself reads the feature flag and shows either:
- Disabled: Promotional card with "Enable Error Logging" button
- Enabled: Full dashboard with errors and "Disable" toggle

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

Header Section:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Error Logs                                                     │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Toggle: ● Enabled]                            [🗑 Clear All]
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Statistics Cards (Compass-styled):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │                 │  │                 │  │                 │  │
│  │   📊  24        │  │   🌐  18        │  │   ⚡  6         │  │
│  │   Total Errors  │  │   API Errors    │  │   JS Errors     │  │
│  │                 │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ● Connected                                    Live Feed   ││
│  │  ─────────────────────────────────────────────────────────  ││
│  │  Errors stream in real-time as they occur                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Filter Bar:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Type: [All ▼]  [API ▼]  [JS ▼]     🔍 Search errors...         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Error Cards (Beautiful, Informative):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  ● API Error                                 2 seconds ago  ││
│  │  ───────────────────────────────────────────────────────── ││
│  │                                                             ││
│  │  POST /api/v4/posts                                         ││
│  │  500 Internal Server Error                                  ││
│  │                                                             ││
│  │  👤 john.doe                                                ││
│  │  🌐 Chrome 120 on Windows                                   ││
│  │                                                             ││
│  │  ▼ Stack Trace                                              ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ Error: Database connection failed                       │││
│  │  │   at SqlPostStore.Save (post_store.go:145)              │││
│  │  │   at App.CreatePost (post.go:89)                        │││
│  │  │   at Api4.createPost (post.go:42)                       │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  ● JavaScript Error                         15 seconds ago  ││
│  │  ───────────────────────────────────────────────────────── ││
│  │                                                             ││
│  │  TypeError: Cannot read property 'id' of undefined          ││
│  │                                                             ││
│  │  👤 jane.smith                                              ││
│  │  📍 /channels/town-square                                   ││
│  │  🌐 Firefox 121 on macOS                                    ││
│  │                                                             ││
│  │  ▶ Stack Trace (click to expand)                            ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Empty State (when no errors):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                          ✨                                     │
│                                                                 │
│                   No errors recorded                            │
│                                                                 │
│          Errors will appear here in real-time as they occur.    │
│                   Your users are having a good day!             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Animation Details:
- New errors slide in from the top with a subtle fade-in animation
- Error cards have a brief highlight pulse when first appearing
- Stack traces expand/collapse with smooth accordion animation
- Statistics cards animate number changes

4. Features

- Real-time updates - New errors appear instantly via WebSocket
- Filtering - Filter by type (API/JS), time range, user
- Search - Search by message, stack trace, or user
- Expandable stack traces - Click to expand/collapse
- Statistics cards - Total, API, JS counts
- Live indicator - Shows when connected and receiving updates
- Clear all - Admin can clear the buffer
- Time display - Relative time (e.g., "2 seconds ago")
- Enable/Disable toggle - Turn error collection on/off from dashboard

5. Visual Design Details

Color Palette:
┌─────────────────┬───────────────────────────┬──────────────────────────────┐
│     Element     │      Color Variable       │           Purpose            │
├─────────────────┼───────────────────────────┼──────────────────────────────┤
│ API Error badge │ --sys-dnd-indicator       │ Red indicator for API errors │
├─────────────────┼───────────────────────────┼──────────────────────────────┤
│ JS Error badge  │ --sys-away-indicator      │ Yellow/orange for JS errors  │
├─────────────────┼───────────────────────────┼──────────────────────────────┤
│ Success/Live    │ --sys-online-indicator    │ Green for connected state    │
├─────────────────┼───────────────────────────┼──────────────────────────────┤
│ Card background │ --center-channel-bg       │ Standard card background     │
├─────────────────┼───────────────────────────┼──────────────────────────────┤
│ Card border     │ --center-channel-color-08 │ Subtle borders               │
└─────────────────┴───────────────────────────┴──────────────────────────────┘
Icons (Compass):
┌──────────────┬──────────────────────┐
│   Context    │         Icon         │
├──────────────┼──────────────────────┤
│ API Error    │ alert-circle-outline │
├──────────────┼──────────────────────┤
│ JS Error     │ lightning-bolt       │
├──────────────┼──────────────────────┤
│ User         │ account-outline      │
├──────────────┼──────────────────────┤
│ URL/Location │ map-marker-outline   │
├──────────────┼──────────────────────┤
│ Browser      │ web                  │
├──────────────┼──────────────────────┤
│ Time         │ clock-outline        │
├──────────────┼──────────────────────┤
│ Stack trace  │ code-json            │
├──────────────┼──────────────────────┤
│ Clear        │ delete-outline       │
├──────────────┼──────────────────────┤
│ Search       │ magnify              │
├──────────────┼──────────────────────┤
│ Filter       │ filter-variant       │
└──────────────┴──────────────────────┘
Typography:
- Error message: font-weight: 600, slightly larger
- Metadata (user, URL): font-size: 13px, muted color
- Stack trace: font-family: monospace, font-size: 12px
- Timestamps: font-size: 12px, muted, right-aligned

Spacing:
- Card padding: 16px
- Card margin: 12px between cards
- Section gaps: 24px
- Border radius: 8px for cards, 4px for badges

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