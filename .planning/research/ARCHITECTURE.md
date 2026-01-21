# Architecture Research: Scheduled Recaps

**Researched:** 2026-01-21
**Confidence:** HIGH (based on direct codebase analysis)

## Executive Summary

The existing recap architecture is well-structured and follows Mattermost patterns cleanly. Adding scheduling requires:
1. New `ScheduledRecaps` database table
2. New scheduled recap store layer
3. Custom scheduler that queries user-defined schedules
4. Extended API endpoints
5. Enhanced frontend wizard + "Scheduled" tab

The critical insight: Mattermost's job server has two patterns - **static schedulers** (config-driven, like product notices) and **data-driven schedulers** (query database for when to trigger). Scheduled recaps need the latter pattern.

---

## Existing Components

### Backend Layer Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│            server/channels/api4/recap.go                        │
│   Endpoints: POST /recaps, GET /recaps, GET /recaps/{id},       │
│              POST /recaps/{id}/read, POST /recaps/{id}/regenerate│
│              DELETE /recaps/{id}                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      App Layer                                   │
│              server/channels/app/recap.go                       │
│   Functions: CreateRecap, GetRecap, GetRecapsForUser,           │
│              MarkRecapAsRead, RegenerateRecap, DeleteRecap,     │
│              ProcessRecapChannel                                 │
│                                                                  │
│              server/channels/app/summarization.go               │
│   Functions: SummarizePosts (calls AI agent via bridge)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Store Layer                                  │
│          server/channels/store/sqlstore/recap_store.go          │
│   Interface: RecapStore                                          │
│   Methods: SaveRecap, GetRecap, GetRecapsForUser, UpdateRecap,  │
│            UpdateRecapStatus, MarkRecapAsRead, DeleteRecap,     │
│            SaveRecapChannel, GetRecapChannelsByRecapId,         │
│            DeleteRecapChannels                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Database Layer                                │
│   Tables: Recaps, RecapChannels                                  │
│   Migration: 000149_create_recaps.up.sql                        │
└─────────────────────────────────────────────────────────────────┘
```

### Job Server Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Job Server                                    │
│           server/channels/jobs/server.go                        │
├─────────────────────────────────────────────────────────────────┤
│  Workers                     │  Schedulers                       │
│  server/channels/jobs/       │  server/channels/jobs/            │
│  workers.go                  │  schedulers.go                    │
│                              │                                   │
│  - Map of worker instances   │  - Map of scheduler instances    │
│  - Config-driven enable      │  - Timer-based polling (1 min)   │
│  - Run/Stop lifecycle        │  - NextScheduleTime() interface  │
│                              │  - Leader election awareness     │
└─────────────────────────────────────────────────────────────────┘
```

### Current Recap Worker

```go
// server/channels/jobs/recap/worker.go
type AppIface interface {
    ProcessRecapChannel(rctx request.CTX, recapID, channelID, userID, agentID string) (*model.RecapChannelResult, *model.AppError)
    Publish(message *model.WebSocketEvent)
}

func MakeWorker(jobServer *jobs.JobServer, storeInstance store.Store, appInstance AppIface) *jobs.SimpleWorker
```

**Key observation:** The recap worker is a **SimpleWorker** - it just processes jobs that are already created. It does NOT have a scheduler because recaps are currently triggered on-demand by API calls.

### Frontend Components

```
webapp/channels/src/components/
├── recaps/
│   ├── recaps.tsx              # Main container with tabs (Unread/Read)
│   ├── recaps_list.tsx         # List of recap items
│   ├── recap_item.tsx          # Individual recap card
│   ├── recap_channel_card.tsx  # Per-channel summary display
│   ├── recap_processing.tsx    # Processing state component
│   ├── recap_menu.tsx          # Dropdown menu (delete, regenerate)
│   └── recap_text_formatter.tsx # Formats highlights/action items
│
├── create_recap_modal/
│   ├── create_recap_modal.tsx  # 3-step wizard container
│   ├── recap_configuration.tsx # Step 1: Name + type selection
│   ├── channel_selector.tsx    # Step 2: Channel picker
│   └── channel_summary.tsx     # Step 3: Confirmation
```

### Redux State

```
webapp/channels/src/packages/mattermost-redux/
├── src/actions/recaps.ts       # Action creators
├── src/action_types/recaps.ts  # Action type constants
├── src/reducers/recaps.ts      # State reducer
├── src/selectors/recaps.ts     # Selectors (getUnreadRecaps, getReadRecaps)
└── client/client4.ts           # API client methods
```

### Database Schema (Current)

```sql
-- Recaps table
CREATE TABLE Recaps (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    Title VARCHAR(255) NOT NULL,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT NOT NULL,
    TotalMessageCount INT NOT NULL,
    Status VARCHAR(32) NOT NULL,     -- pending, processing, completed, failed
    ReadAt BIGINT DEFAULT 0,
    BotID VARCHAR(26) DEFAULT ''
);

-- RecapChannels table
CREATE TABLE RecapChannels (
    Id VARCHAR(26) PRIMARY KEY,
    RecapId VARCHAR(26) NOT NULL,
    ChannelId VARCHAR(26) NOT NULL,
    ChannelName VARCHAR(64) NOT NULL,
    Highlights TEXT,                  -- JSON array
    ActionItems TEXT,                 -- JSON array
    SourcePostIds TEXT,               -- JSON array
    CreateAt BIGINT NOT NULL,
    FOREIGN KEY (RecapId) REFERENCES Recaps(Id) ON DELETE CASCADE
);
```

---

## New Components Needed

### 1. Database: ScheduledRecaps Table

```sql
CREATE TABLE ScheduledRecaps (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    Title VARCHAR(255) NOT NULL,
    
    -- Schedule configuration
    DaysOfWeek VARCHAR(32) NOT NULL,  -- Comma-separated: "mon,tue,wed,thu,fri"
    TimeOfDay VARCHAR(5) NOT NULL,     -- "09:00" (24h format, UTC)
    TimePeriod VARCHAR(16) NOT NULL,   -- "1_day", "3_days", "7_days"
    Timezone VARCHAR(64) NOT NULL,     -- User's timezone for accurate scheduling
    
    -- Source configuration
    SourceType VARCHAR(16) NOT NULL,   -- "channels" or "topics"
    ChannelIds TEXT,                   -- JSON array of channel IDs (if channels)
    Topics TEXT,                       -- JSON array of topic strings (if topics)
    CustomInstructions TEXT,           -- Optional custom AI instructions
    
    -- Agent configuration
    AgentId VARCHAR(26) NOT NULL,
    
    -- State
    Enabled BOOLEAN NOT NULL DEFAULT true,
    NextRunAt BIGINT,                  -- Pre-calculated next execution time
    LastRunAt BIGINT,                  -- Last execution timestamp
    LastRecapId VARCHAR(26),           -- Reference to last generated Recap
    
    -- Audit
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT DEFAULT 0,
    
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (AgentId) REFERENCES Bots(UserId)
);

CREATE INDEX idx_scheduled_recaps_user_id ON ScheduledRecaps(UserId);
CREATE INDEX idx_scheduled_recaps_enabled_next_run ON ScheduledRecaps(Enabled, NextRunAt);
CREATE INDEX idx_scheduled_recaps_user_delete ON ScheduledRecaps(UserId, DeleteAt);
```

### 2. Model: ScheduledRecap

```go
// server/public/model/scheduled_recap.go
package model

type ScheduledRecap struct {
    Id                 string   `json:"id"`
    UserId             string   `json:"user_id"`
    Title              string   `json:"title"`
    
    // Schedule
    DaysOfWeek         []string `json:"days_of_week"`        // ["mon", "tue", ...]
    TimeOfDay          string   `json:"time_of_day"`         // "09:00"
    TimePeriod         string   `json:"time_period"`         // "1_day", "3_days", "7_days"
    Timezone           string   `json:"timezone"`            // "America/New_York"
    
    // Source
    SourceType         string   `json:"source_type"`         // "channels" or "topics"
    ChannelIds         []string `json:"channel_ids,omitempty"`
    Topics             []string `json:"topics,omitempty"`
    CustomInstructions string   `json:"custom_instructions,omitempty"`
    
    // Agent
    AgentId            string   `json:"agent_id"`
    
    // State
    Enabled            bool     `json:"enabled"`
    NextRunAt          int64    `json:"next_run_at"`
    LastRunAt          int64    `json:"last_run_at"`
    LastRecapId        string   `json:"last_recap_id,omitempty"`
    
    // Audit
    CreateAt           int64    `json:"create_at"`
    UpdateAt           int64    `json:"update_at"`
    DeleteAt           int64    `json:"delete_at"`
}

const (
    TimePeriod1Day  = "1_day"
    TimePeriod3Days = "3_days"
    TimePeriod7Days = "7_days"
)
```

### 3. Store: ScheduledRecapStore

```go
// server/channels/store/store.go (interface addition)
type ScheduledRecapStore interface {
    Save(scheduledRecap *model.ScheduledRecap) (*model.ScheduledRecap, error)
    Update(scheduledRecap *model.ScheduledRecap) (*model.ScheduledRecap, error)
    Get(id string) (*model.ScheduledRecap, error)
    GetForUser(userId string, page, perPage int) ([]*model.ScheduledRecap, error)
    Delete(id string) error
    
    // Scheduler queries
    GetDueSchedules(before int64, limit int) ([]*model.ScheduledRecap, error)
    UpdateNextRunAt(id string, nextRunAt int64) error
    UpdateLastRun(id string, lastRunAt int64, lastRecapId string) error
}
```

### 4. Scheduler: ScheduledRecapScheduler

**Critical design decision:** Unlike static schedulers (e.g., ProductNoticesScheduler), this needs to be a **data-driven scheduler** that queries the database for due schedules.

```go
// server/channels/jobs/scheduled_recap/scheduler.go
package scheduled_recap

type Scheduler struct {
    jobs     *jobs.JobServer
    store    store.Store
    app      AppIface
}

func (s *Scheduler) Enabled(cfg *model.Config) bool {
    return cfg.FeatureFlags.EnableAIRecaps
}

func (s *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
    // Poll every minute for due scheduled recaps
    nextTime := now.Add(1 * time.Minute)
    return &nextTime
}

func (s *Scheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
    // Query for due schedules
    dueSchedules, err := s.store.ScheduledRecap().GetDueSchedules(time.Now().UnixMilli(), 100)
    if err != nil {
        return nil, model.NewAppError(...)
    }
    
    // Create jobs for each due schedule
    for _, schedule := range dueSchedules {
        // Create recap job with schedule context
        jobData := map[string]string{
            "scheduled_recap_id": schedule.Id,
            "user_id":           schedule.UserId,
            "channel_ids":       strings.Join(schedule.ChannelIds, ","),
            "agent_id":          schedule.AgentId,
            "time_period":       schedule.TimePeriod,
        }
        
        s.jobs.CreateJob(rctx, model.JobTypeRecap, jobData)
        
        // Update next run time
        nextRun := calculateNextRunTime(schedule)
        s.store.ScheduledRecap().UpdateNextRunAt(schedule.Id, nextRun)
    }
    
    return nil, nil // Scheduler doesn't return a single job
}
```

### 5. Enhanced Recap Worker

The existing worker needs to handle scheduled recap jobs which have a `time_period` that affects which posts to fetch.

```go
// Modification to server/channels/jobs/recap/worker.go
func processRecapJob(logger mlog.LoggerIFace, job *model.Job, ...) error {
    // New: Check for scheduled recap context
    scheduledRecapId := job.Data["scheduled_recap_id"]
    timePeriod := job.Data["time_period"]
    
    if scheduledRecapId != "" {
        // This is a scheduled recap - use time period instead of last viewed
        // Calculate since timestamp based on time_period
        since := calculateSinceTimestamp(timePeriod)
        // ... process with time-based window instead of last_viewed
    }
    
    // ... existing processing logic
}
```

### 6. API Endpoints

```go
// server/channels/api4/scheduled_recap.go
func (api *API) InitScheduledRecap() {
    api.BaseRoutes.ScheduledRecaps.Handle("", api.APISessionRequired(createScheduledRecap)).Methods(http.MethodPost)
    api.BaseRoutes.ScheduledRecaps.Handle("", api.APISessionRequired(getScheduledRecaps)).Methods(http.MethodGet)
    api.BaseRoutes.ScheduledRecaps.Handle("/{scheduled_recap_id:[A-Za-z0-9]+}", api.APISessionRequired(getScheduledRecap)).Methods(http.MethodGet)
    api.BaseRoutes.ScheduledRecaps.Handle("/{scheduled_recap_id:[A-Za-z0-9]+}", api.APISessionRequired(updateScheduledRecap)).Methods(http.MethodPut)
    api.BaseRoutes.ScheduledRecaps.Handle("/{scheduled_recap_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteScheduledRecap)).Methods(http.MethodDelete)
    api.BaseRoutes.ScheduledRecaps.Handle("/{scheduled_recap_id:[A-Za-z0-9]+}/enable", api.APISessionRequired(enableScheduledRecap)).Methods(http.MethodPost)
    api.BaseRoutes.ScheduledRecaps.Handle("/{scheduled_recap_id:[A-Za-z0-9]+}/disable", api.APISessionRequired(disableScheduledRecap)).Methods(http.MethodPost)
    api.BaseRoutes.ScheduledRecaps.Handle("/{scheduled_recap_id:[A-Za-z0-9]+}/run-now", api.APISessionRequired(runScheduledRecapNow)).Methods(http.MethodPost)
}
```

### 7. Frontend: Enhanced Wizard

```
webapp/channels/src/components/create_recap_modal/
├── create_recap_modal.tsx        # Enhanced: 4-5 step wizard
├── recap_configuration.tsx       # Step 1: Name + AI agent (existing, enhanced)
├── recap_source_type.tsx         # Step 2: Channels vs Topics selection (NEW)
├── channel_selector.tsx          # Step 2a: Channel picker (existing)
├── topic_selector.tsx            # Step 2b: Topic input (NEW)
├── schedule_configuration.tsx    # Step 3: Days/time/period (NEW)
├── custom_instructions.tsx       # Step 4: Optional AI instructions (NEW)
└── recap_summary.tsx             # Step 5: Review & confirm (NEW, replaces channel_summary)
```

### 8. Frontend: Scheduled Tab

```
webapp/channels/src/components/recaps/
├── recaps.tsx                    # Enhanced: 3 tabs (Unread/Read/Scheduled)
├── scheduled_recaps_list.tsx     # NEW: List of scheduled recaps
├── scheduled_recap_item.tsx      # NEW: Individual scheduled recap card
└── scheduled_recap_menu.tsx      # NEW: Edit/Pause/Resume/Delete actions
```

---

## Data Flow

### Creating a Scheduled Recap

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Frontend      │────▶│   API Layer      │────▶│   App Layer       │
│   Wizard        │     │   POST /scheduled│     │   CreateScheduled │
│                 │     │   -recaps        │     │   Recap()         │
└─────────────────┘     └──────────────────┘     └─────────┬─────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Redux Store   │◀────│   WebSocket      │◀────│   Store Layer     │
│   Update        │     │   Notification   │     │   Save to DB      │
│                 │     │   (optional)     │     │   Calculate next  │
└─────────────────┘     └──────────────────┘     │   run time        │
                                                 └───────────────────┘
```

### Scheduled Recap Execution

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Job Server                                   │
│                    (runs every minute)                               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  ScheduledRecapScheduler                             │
│   1. Query: GetDueSchedules(now)                                    │
│   2. For each due schedule:                                          │
│      a. Create Job with scheduled_recap_id, time_period              │
│      b. Update NextRunAt for this schedule                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RecapWorker                                     │
│   1. Check if scheduled_recap_id present                            │
│   2. Calculate time window from time_period (not last_viewed)       │
│   3. For each channel:                                               │
│      a. Fetch posts within time window                              │
│      b. Call AI agent for summarization                             │
│      c. Save RecapChannel                                           │
│   4. Update ScheduledRecap.LastRunAt, LastRecapId                   │
│   5. Publish WebSocket event to user                                │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend                                     │
│   1. Receive WebSocket: recap_updated                               │
│   2. Fetch updated recap                                             │
│   3. Show in Unread tab                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Timezone Handling Flow

```
User creates schedule:
  Frontend (local time "9:00 AM") 
    → API (includes timezone "America/New_York")
    → Store (saves TimeOfDay="09:00", Timezone="America/New_York")
    → Calculate NextRunAt in UTC milliseconds

Scheduler checks due schedules:
  Scheduler queries: WHERE NextRunAt <= NOW() AND Enabled = true
  (All comparisons in UTC, no timezone conversion needed at query time)

After execution:
  Calculate next run using stored TimeOfDay + Timezone
  Convert to UTC for NextRunAt storage
```

---

## Integration Points

### Where New Code Touches Existing Code

| New Component | Existing Component | Integration Type |
|---------------|-------------------|------------------|
| ScheduledRecapStore | store.go interface | Add to Store interface |
| ScheduledRecapScheduler | jobs/schedulers.go | Register new scheduler |
| Enhanced RecapWorker | jobs/recap/worker.go | Add time_period handling |
| API routes | api4/api.go | Add route group |
| Frontend wizard | create_recap_modal.tsx | Extend existing component |
| Scheduled tab | recaps.tsx | Add third tab |
| Redux actions | actions/recaps.ts | Add scheduled recap actions |
| Client4 | client4.ts | Add scheduled recap methods |

### Shared Components (No Duplication)

These existing components should be reused:

1. **AI Summarization** (`app/summarization.go`) - No changes needed
2. **Channel permission checks** (`app/recap.go:CreateRecap`) - Extract to shared function
3. **WebSocket publication** (`recap/worker.go:publishRecapUpdate`) - Reuse as-is
4. **AgentDropdown** component - Reuse in enhanced wizard
5. **ChannelSelector** component - Reuse for channel-based scheduled recaps

---

## Build Order Recommendation

### Phase 1: Database Foundation
**Why first:** Everything depends on data storage.

1. Create migration for ScheduledRecaps table
2. Create ScheduledRecap model
3. Create ScheduledRecapStore interface
4. Implement SqlScheduledRecapStore
5. Write store tests

**Deliverable:** Can CRUD scheduled recaps via direct store calls.

### Phase 2: API Layer
**Why second:** Backend complete before frontend, testable independently.

1. Add ScheduledRecap routes to API
2. Implement API handlers (CRUD + enable/disable/run-now)
3. Add app layer functions
4. Add audit logging
5. Write API tests

**Deliverable:** Can CRUD scheduled recaps via REST API.

### Phase 3: Scheduler + Worker Enhancement
**Why third:** Core automation logic, depends on database being stable.

1. Create ScheduledRecapScheduler
2. Register scheduler in job server
3. Enhance RecapWorker to handle time_period
4. Calculate next run time logic
5. Write scheduler tests

**Deliverable:** Scheduled recaps trigger automatically at configured times.

### Phase 4: Frontend - Scheduled Tab
**Why fourth:** Read-only view of scheduled recaps, lower risk.

1. Add Redux actions for scheduled recaps
2. Add Client4 methods
3. Create scheduled_recaps_list.tsx
4. Create scheduled_recap_item.tsx
5. Add "Scheduled" tab to recaps.tsx
6. Implement pause/resume/delete from list

**Deliverable:** Users can view and manage existing scheduled recaps.

### Phase 5: Frontend - Enhanced Wizard
**Why last:** Most complex UI changes, benefits from stable backend.

1. Create schedule_configuration.tsx component
2. Create topic_selector.tsx component
3. Enhance create_recap_modal.tsx for new flow
4. Add "Run once" option for backwards compatibility
5. Create recap_summary.tsx (enhanced confirmation)
6. Wire up API calls

**Deliverable:** Users can create new scheduled recaps through the UI.

---

## Component Boundaries Summary

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                   │
├────────────────────────────────────────────────────────────────────────┤
│  create_recap_modal/     │  recaps/                │  Redux            │
│  ─────────────────────   │  ────────               │  ─────            │
│  • Wizard orchestration  │  • List display         │  • State mgmt     │
│  • Step navigation       │  • Tab switching        │  • API calls      │
│  • Form validation       │  • Item rendering       │  • Selectors      │
│  • Schedule config UI    │  • Menu actions         │                   │
└──────────────────────────┴─────────────────────────┴───────────────────┘
                                      │
                                      │ HTTP REST
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                    │
├────────────────────────────────────────────────────────────────────────┤
│  api4/                   │  app/                   │  jobs/            │
│  ─────                   │  ────                   │  ─────            │
│  • Request validation    │  • Business logic       │  • Scheduling     │
│  • Auth/permissions      │  • Permission checks    │  • Job execution  │
│  • Response formatting   │  • Orchestration        │  • Worker mgmt    │
│  • Audit logging         │  • AI integration       │                   │
├──────────────────────────┴─────────────────────────┴───────────────────┤
│  store/                                                                 │
│  ──────                                                                 │
│  • Data persistence                                                     │
│  • Query optimization                                                   │
│  • Transaction handling                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Patterns to Follow

### 1. Use Existing Job Server Pattern
Follow the ProductNoticesScheduler pattern but with database-driven scheduling:
- Implement Scheduler interface
- Register in schedulers map
- Poll for due items

### 2. Use Existing Store Pattern
Follow SqlRecapStore as template:
- Squirrel query builder
- Map conversion functions
- Proper error wrapping

### 3. Use Existing API Pattern
Follow recap.go API as template:
- Session-required middleware
- Audit logging
- Permission checks
- Consistent error responses

### 4. Use Existing Frontend Pattern
Follow create_recap_modal.tsx as template:
- GenericModal wrapper
- Step-based navigation
- Compass icons
- SCSS modules

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Timezone bugs | Store all times as UTC, convert only at display |
| Scheduler misfire during deploy | Include catch-up logic for missed schedules |
| Too many simultaneous jobs | Batch limit in GetDueSchedules, stagger execution |
| User deletes channel in schedule | Validate channels on each run, skip deleted |
| AI agent becomes unavailable | Existing retry/failure handling in worker |

---

## Sources

- Direct codebase analysis (HIGH confidence)
- Existing patterns in server/channels/jobs/*.go
- Existing patterns in server/channels/api4/*.go
- Existing patterns in webapp/channels/src/components/
- Database migrations in server/channels/db/migrations/
