# Stack Research: Scheduled Recaps

**Domain:** Recurring scheduled jobs in Mattermost (Go/PostgreSQL)
**Researched:** 2026-01-21
**Overall Confidence:** HIGH

## Executive Summary

Mattermost has a mature, well-documented job system that provides multiple patterns for scheduled work. For scheduled recaps, the recommended approach is to use **direct database polling with `CreateRecurringTaskFromNextIntervalTime`** (like ScheduledPosts), NOT the traditional JobServer scheduler system. The JobServer is designed for system-wide scheduled jobs, while per-user scheduled tasks need a different pattern.

The key insight: Mattermost already solved this exact problem for Scheduled Posts. That implementation should be the primary reference.

---

## Mattermost Job Server

### How It Works

The job server (`server/channels/jobs/`) provides infrastructure for background tasks:

```
JobServer
├── Workers (execute jobs)
├── Schedulers (decide when to create jobs)
└── Watcher (polls for pending jobs)
```

**Core Components:**

| Component | File | Purpose |
|-----------|------|---------|
| `JobServer` | `server.go` | Central coordinator |
| `Scheduler` interface | `schedulers.go` | Determines next run time |
| `Worker` interface | `base_workers.go` | Executes job logic |
| `Job` model | `model/job.go` | Database-persisted job record |

### Built-in Scheduler Types

**1. PeriodicScheduler** - Runs at fixed intervals
```go
// server/channels/jobs/base_schedulers.go
jobs.NewPeriodicScheduler(jobServer, jobType, 10*time.Minute, enabledFunc)
```

**2. DailyScheduler** - Runs once per day at a specific time
```go
// Used by refresh_materialized_views, data_retention, message_export
jobs.NewDailyScheduler(jobServer, jobType, startTimeFunc, enabledFunc)
```

### When to Use JobServer

**APPROPRIATE for:**
- System-wide jobs (one job per cluster)
- Jobs that need cluster leader election
- Jobs stored in the Jobs table
- Jobs that are config-driven (enabled via system settings)

**NOT appropriate for:**
- Per-user scheduled tasks
- Tasks that need to run at user-specified times
- Tasks where thousands of schedules exist simultaneously

**Confidence:** HIGH (verified by reading `server/channels/jobs/server.go`, `schedulers.go`, `base_schedulers.go`)

---

## Scheduled Posts Pattern (Reference Implementation)

### How Scheduled Posts Work

Mattermost already has per-user scheduled delivery implemented for **Scheduled Posts**. This is the correct pattern for scheduled recaps.

**Architecture:**
```
ScheduledPosts Table (user-specific schedules)
        │
        ▼
CreateRecurringTaskFromNextIntervalTime (1-minute polling loop)
        │
        ▼
ProcessScheduledPosts() (app-level processor)
        │
        ▼
Individual post creation
```

**Key Code Locations:**
- `server/channels/app/server.go:1847-1858` - Job initialization
- `server/channels/app/scheduled_post_job.go` - Processing logic
- `server/channels/store/sqlstore/scheduled_post_store.go` - Database layer

**How It Runs:**
```go
// server/channels/app/server.go
func doRunScheduledPostJob(a *App) {
    jobInterval := scheduledPostJobInterval  // 1 minute
    rctx := request.EmptyContext(a.Log())
    withMut(&a.ch.scheduledPostMut, func() {
        fn := func() { a.ProcessScheduledPosts(rctx) }
        a.ch.scheduledPostTask = model.CreateRecurringTaskFromNextIntervalTime(
            "Process Scheduled Posts", fn, jobInterval)
    })
}
```

**Confidence:** HIGH (verified by reading actual implementation)

---

## Database Schema Patterns

### Schedule Storage Approaches

**Option 1: Cron Expressions (NOT RECOMMENDED)**
```sql
-- Anti-pattern for this use case
schedule VARCHAR(100)  -- "0 9 * * 1,2,3,4,5"
```
- Requires cron parsing library
- Complex timezone handling
- Overkill for simple "day of week + time" schedules
- Not used anywhere in Mattermost codebase

**Option 2: Structured Fields (RECOMMENDED)**
```sql
-- Like ScheduledPosts uses
scheduledat BIGINT      -- Next execution timestamp (UTC millis)
userid VARCHAR(26)      -- Owner
channelid VARCHAR(26)   -- Target
```

**Option 3: JSON Schedule Configuration (RECOMMENDED for Recurring)**
```sql
-- For recurring recap schedules
CREATE TABLE RecapSchedules (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    ChannelIds TEXT NOT NULL,           -- JSON array of channel IDs
    AgentId VARCHAR(26) NOT NULL,
    DaysOfWeek TEXT NOT NULL,           -- JSON array: [1,2,3,4,5] for weekdays
    TimeOfDay VARCHAR(5) NOT NULL,      -- "09:00" (HH:MM)
    Timezone VARCHAR(64) NOT NULL,      -- "America/New_York"
    PeriodDays INT NOT NULL DEFAULT 7,  -- How many days to recap
    NextRunAt BIGINT NOT NULL,          -- Pre-computed next execution (UTC)
    Enabled BOOLEAN DEFAULT true,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT DEFAULT 0
);

CREATE INDEX idx_recapschedules_userid ON RecapSchedules(UserId);
CREATE INDEX idx_recapschedules_nextrunat_enabled ON RecapSchedules(NextRunAt, Enabled, DeleteAt);
```

**Why Pre-computed `NextRunAt`:**
- Efficient polling query: `WHERE NextRunAt <= ? AND Enabled = true AND DeleteAt = 0`
- Avoids complex timezone calculations during polling
- Recalculate after each execution

**Confidence:** HIGH (pattern verified from ScheduledPosts implementation)

---

## Timezone Handling Best Practices

### The Problem

Users set schedules like "9 AM on weekdays" but mean different UTC times depending on timezone and DST.

### The Solution

**Store:**
- User's timezone (IANA format: "America/New_York")
- Time of day as string ("09:00")
- Days of week as integers (0-6, Sunday=0)
- Pre-computed `NextRunAt` in UTC milliseconds

**Compute NextRunAt on Write:**
```go
func ComputeNextRunAt(schedule *RecapSchedule) int64 {
    loc, err := time.LoadLocation(schedule.Timezone)
    if err != nil {
        loc = time.UTC
    }
    
    now := time.Now().In(loc)
    targetTime, _ := time.Parse("15:04", schedule.TimeOfDay)
    
    // Find next day that matches schedule
    for daysAhead := 0; daysAhead < 8; daysAhead++ {
        candidate := now.AddDate(0, 0, daysAhead)
        candidateWeekday := int(candidate.Weekday())
        
        if contains(schedule.DaysOfWeek, candidateWeekday) {
            scheduled := time.Date(
                candidate.Year(), candidate.Month(), candidate.Day(),
                targetTime.Hour(), targetTime.Minute(), 0, 0, loc)
            
            if scheduled.After(now) {
                return scheduled.UTC().UnixMilli()
            }
        }
    }
    return 0
}
```

**Re-compute after execution and on timezone/schedule change.**

**Existing Pattern:**
```go
// server/channels/jobs/jobs.go:295-302
func GenerateNextStartDateTime(now time.Time, nextStartTime time.Time) *time.Time {
    nextTime := time.Date(now.Year(), now.Month(), now.Day(), 
        nextStartTime.Hour(), nextStartTime.Minute(), 0, 0, time.Local)
    
    if !now.Before(nextTime) {
        nextTime = nextTime.AddDate(0, 0, 1)
    }
    return &nextTime
}
```

**Important:** Mattermost uses `time.Local` in some places, but for user-specific schedules, always use the user's explicit timezone.

**Confidence:** HIGH (pattern verified; timezone handling is standard Go)

---

## Recommendations

### 1. Follow the ScheduledPosts Pattern

**DO:**
```go
// Create a recurring task that polls for due schedules
func doRunScheduledRecapJob(a *App) {
    jobInterval := 1 * time.Minute
    rctx := request.EmptyContext(a.Log())
    withMut(&a.ch.scheduledRecapMut, func() {
        fn := func() { a.ProcessScheduledRecaps(rctx) }
        a.ch.scheduledRecapTask = model.CreateRecurringTaskFromNextIntervalTime(
            "Process Scheduled Recaps", fn, jobInterval)
    })
}

// Process due schedules
func (a *App) ProcessScheduledRecaps(rctx request.CTX) {
    now := model.GetMillis()
    
    schedules, err := a.Srv().Store().RecapSchedule().GetDueSchedules(now, pageSize)
    // ... process each, create recap jobs, update NextRunAt
}
```

**Rationale:**
- Proven pattern in production
- Handles cluster leader election properly
- Efficient database polling

### 2. Use Existing Recap Job Worker

**DO:** Reuse the existing `recap` job worker for actual recap generation:
```go
// server/channels/jobs/recap/worker.go already exists
// Scheduled recap processing should create jobs for this worker

func (a *App) ProcessScheduledRecaps(rctx request.CTX) {
    for _, schedule := range dueSchedules {
        // Create a standard recap job
        _, err := a.CreateJob(rctx, &model.Job{
            Type: model.JobTypeRecap,
            Data: map[string]string{
                "recap_id":    recapID,
                "channel_ids": strings.Join(schedule.ChannelIds, ","),
                "user_id":     schedule.UserId,
                "agent_id":    schedule.AgentId,
                "schedule_id": schedule.Id,  // To update NextRunAt after completion
            },
        })
        
        // Update NextRunAt immediately to prevent re-triggering
        a.Srv().Store().RecapSchedule().UpdateNextRunAt(schedule.Id, 
            ComputeNextRunAt(schedule))
    }
}
```

**Rationale:**
- Recap generation logic already implemented
- Consistent job tracking via Jobs table
- Proper error handling and retry logic

### 3. New Store Interface

```go
// Add to server/channels/store/store.go
type RecapScheduleStore interface {
    Save(schedule *model.RecapSchedule) (*model.RecapSchedule, error)
    Update(schedule *model.RecapSchedule) (*model.RecapSchedule, error)
    Get(id string) (*model.RecapSchedule, error)
    GetForUser(userId string) ([]*model.RecapSchedule, error)
    GetDueSchedules(beforeTime int64, limit int) ([]*model.RecapSchedule, error)
    UpdateNextRunAt(id string, nextRunAt int64) error
    Delete(id string) error
}
```

### 4. Model Structure

```go
// Add to server/public/model/recap.go or new file
type RecapSchedule struct {
    Id          string   `json:"id"`
    UserId      string   `json:"user_id"`
    ChannelIds  []string `json:"channel_ids"`
    AgentId     string   `json:"agent_id"`
    DaysOfWeek  []int    `json:"days_of_week"`   // 0-6, Sunday=0
    TimeOfDay   string   `json:"time_of_day"`    // "09:00"
    Timezone    string   `json:"timezone"`       // "America/New_York"
    PeriodDays  int      `json:"period_days"`    // Default 7
    NextRunAt   int64    `json:"next_run_at"`    // UTC milliseconds
    Enabled     bool     `json:"enabled"`
    CreateAt    int64    `json:"create_at"`
    UpdateAt    int64    `json:"update_at"`
    DeleteAt    int64    `json:"delete_at"`
}
```

---

## Anti-patterns

### 1. DON'T Use Cron Expressions

```go
// WRONG - Overly complex for this use case
type RecapSchedule struct {
    CronExpression string  // "0 9 * * 1-5"
}
```

**Why:** Requires external library, complex parsing, timezone edge cases

### 2. DON'T Create New Job Types for Scheduling

```go
// WRONG - Don't register scheduled recaps as a JobServer scheduler
jobs.RegisterJobType("scheduled_recap", scheduledRecapWorker, scheduledRecapScheduler)
```

**Why:** JobServer schedulers are for system-wide jobs (one per cluster), not per-user schedules

### 3. DON'T Poll Without Indexes

```go
// WRONG - Missing index on query columns
SELECT * FROM RecapSchedules WHERE NextRunAt <= ? AND Enabled = true
```

**Why:** Without proper indexes, this becomes O(n) table scan

### 4. DON'T Store Timezone as Offset

```go
// WRONG
Timezone: "+05:00"  // Doesn't handle DST!
```

**Why:** UTC offsets don't account for daylight saving time changes

### 5. DON'T Calculate NextRunAt at Query Time

```go
// WRONG - Complex timezone math in SQL
SELECT * FROM RecapSchedules 
WHERE compute_next_run(days_of_week, time_of_day, timezone) <= NOW()
```

**Why:** Expensive, different DB behavior, timezone library not available in SQL

---

## Technology Versions

| Component | Version | Source |
|-----------|---------|--------|
| Go | 1.21+ | Mattermost requirements |
| PostgreSQL | 12+ | Mattermost requirements |
| time package | stdlib | Standard library |
| IANA Time Zone Database | system | Go uses system tzdata |

---

## Implementation Checklist

- [ ] Create `RecapSchedule` model in `server/public/model/`
- [ ] Create `RecapScheduleStore` interface in `server/channels/store/store.go`
- [ ] Implement `SqlRecapScheduleStore` in `server/channels/store/sqlstore/`
- [ ] Create database migration for `RecapSchedules` table
- [ ] Add `ProcessScheduledRecaps` in `server/channels/app/`
- [ ] Initialize recurring task in `server/channels/app/server.go`
- [ ] Modify `recap/worker.go` to handle schedule_id for NextRunAt updates
- [ ] Add API endpoints for CRUD operations
- [ ] Handle cluster leader election (like ScheduledPosts)

---

## Sources

| Source | Confidence | Notes |
|--------|------------|-------|
| `server/channels/jobs/server.go` | HIGH | Direct code review |
| `server/channels/jobs/schedulers.go` | HIGH | Direct code review |
| `server/channels/jobs/base_schedulers.go` | HIGH | Direct code review |
| `server/channels/app/scheduled_post_job.go` | HIGH | Reference implementation |
| `server/channels/app/server.go:1847-1858` | HIGH | Job initialization pattern |
| `server/public/model/scheduled_task.go` | HIGH | Task scheduling infrastructure |
| `server/channels/db/migrations/postgres/000128_create_scheduled_posts.up.sql` | HIGH | Schema pattern |
| `server/channels/db/migrations/postgres/000149_create_recaps.up.sql` | HIGH | Existing recap schema |
