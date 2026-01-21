# Phase 03: Scheduler Integration - Research

**Researched:** Wed Jan 21 2026
**Domain:** Mattermost Job System, Cluster-Safe Scheduling
**Confidence:** HIGH

## Summary

Mattermost has a well-established job system that provides all the infrastructure needed for scheduled recap execution. The system uses a **Scheduler + Worker + Watcher** architecture where:

1. **Schedulers** run only on the cluster leader and periodically create Job records
2. **Workers** poll for pending jobs and execute them (all nodes can run workers)
3. **The Watcher** polls the Jobs table for pending jobs and dispatches to workers via channels
4. **Cluster leadership** is handled automatically via `HandleClusterLeaderChange()` - schedulers only run on leader

The recommended approach for scheduled recaps is to create a **custom scheduler** that polls `ScheduledRecaps.GetDueBefore()` and creates individual `recap` jobs for each due scheduled recap. This follows the existing pattern used by `delete_expired_posts`, `post_persistent_notifications`, and similar jobs.

**Primary recommendation:** Create a `ScheduledRecapScheduler` that extends `PeriodicScheduler`, polls for due scheduled recaps, and creates `JobTypeRecap` jobs with metadata linking back to the ScheduledRecap record.

## Standard Stack

The established architecture for this domain:

### Core (Use Mattermost's Built-in Job System)
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `jobs.JobServer` | `server/channels/jobs/server.go` | Job registration, lifecycle management | Central coordination point |
| `jobs.Scheduler` | `server/channels/jobs/schedulers.go` | Interface for creating jobs on schedule | Only runs on leader node |
| `jobs.PeriodicScheduler` | `server/channels/jobs/base_schedulers.go` | Poll at fixed intervals | Handles jitter, timing |
| `jobs.SimpleWorker` | `server/channels/jobs/base_workers.go` | Execute jobs with minimal boilerplate | Standard execution pattern |
| `jobs.Watcher` | `server/channels/jobs/jobs_watcher.go` | Poll for pending jobs, dispatch to workers | 15-second polling interval |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `model.Job` | Job record with Type, Data, Status | Every job execution |
| `model.JobTypeRecap` | Existing recap job type constant | Reuse for scheduled recaps |
| `store.ScheduledRecapStore.GetDueBefore()` | Query due scheduled recaps | Scheduler polling |
| `store.ScheduledRecapStore.MarkExecuted()` | Update LastRunAt, NextRunAt, RunCount atomically | After successful execution |

### Job Registration Pattern
```go
// In server/channels/app/server.go initJobs()
s.Jobs.RegisterJobType(
    model.JobTypeScheduledRecap,      // Job type constant
    scheduled_recap.MakeWorker(...),  // Worker implementation
    scheduled_recap.MakeScheduler(...), // Scheduler implementation
)
```

## Architecture Patterns

### Recommended Project Structure
```
server/channels/jobs/scheduled_recap/
├── scheduler.go       # Custom scheduler polling GetDueBefore()
└── worker.go          # Worker that processes scheduled recap jobs
```

### Pattern 1: Custom Scheduler Extending PeriodicScheduler

**What:** Create a scheduler that embeds `PeriodicScheduler` and overrides `ScheduleJob` to poll for due scheduled recaps instead of creating a single job.

**When to use:** When job creation depends on database state (due items).

**Example:**
```go
// Source: Based on post_persistent_notifications/scheduler.go pattern
package scheduled_recap

import (
    "time"
    "github.com/mattermost/mattermost/server/public/model"
    "github.com/mattermost/mattermost/server/v8/channels/jobs"
    "github.com/mattermost/mattermost/server/v8/channels/store"
)

const SchedulerPollingInterval = 1 * time.Minute

type Scheduler struct {
    *jobs.PeriodicScheduler
    store store.Store
}

func MakeScheduler(jobServer *jobs.JobServer, storeInstance store.Store) *Scheduler {
    isEnabled := func(cfg *model.Config) bool {
        return cfg.FeatureFlags.EnableAIRecaps
    }
    return &Scheduler{
        PeriodicScheduler: jobs.NewPeriodicScheduler(
            jobServer,
            model.JobTypeScheduledRecap,
            SchedulerPollingInterval,
            isEnabled,
        ),
        store: storeInstance,
    }
}

// Override NextScheduleTime for tighter polling
func (s *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, _ bool, _ *model.Job) *time.Time {
    next := now.Add(SchedulerPollingInterval)
    return &next
}

// Override ScheduleJob to poll for due recaps and create individual jobs
func (s *Scheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, _ bool, _ *model.Job) (*model.Job, *model.AppError) {
    // Get due scheduled recaps
    now := model.GetMillis()
    dueRecaps, err := s.store.ScheduledRecap().GetDueBefore(now, 100)
    if err != nil {
        // Log error, return nil (no job created this cycle)
        return nil, nil
    }

    // Create a job for each due recap
    for _, sr := range dueRecaps {
        jobData := map[string]string{
            "scheduled_recap_id": sr.Id,
            "user_id":           sr.UserId,
            "channel_ids":       strings.Join(sr.ChannelIds, ","),
            "agent_id":          sr.AgentId,
        }
        
        // Use CreateJobOnce to prevent duplicates
        s.jobs.CreateJobOnce(rctx, model.JobTypeScheduledRecap, jobData)
    }

    return nil, nil // Scheduler tracks its own timing
}
```

### Pattern 2: Worker Processing Scheduled Recap Job

**What:** Worker that executes a scheduled recap job, creates the actual Recap, triggers the recap worker, and updates the ScheduledRecap record.

**When to use:** For the job execution logic.

**Example:**
```go
// Source: Based on recap/worker.go and delete_expired_posts/worker.go patterns
package scheduled_recap

import (
    "strings"
    "time"
    "github.com/mattermost/mattermost/server/public/model"
    "github.com/mattermost/mattermost/server/public/shared/mlog"
    "github.com/mattermost/mattermost/server/v8/channels/jobs"
    "github.com/mattermost/mattermost/server/v8/channels/store"
)

type AppIface interface {
    CreateRecapFromSchedule(rctx request.CTX, scheduledRecap *model.ScheduledRecap) (*model.Recap, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, storeInstance store.Store, app AppIface) *jobs.SimpleWorker {
    const workerName = "ScheduledRecap"
    
    isEnabled := func(cfg *model.Config) bool {
        return cfg.FeatureFlags.EnableAIRecaps
    }
    
    execute := func(logger mlog.LoggerIFace, job *model.Job) error {
        defer jobServer.HandleJobPanic(logger, job)
        
        scheduledRecapID := job.Data["scheduled_recap_id"]
        
        // Get the scheduled recap
        sr, err := storeInstance.ScheduledRecap().Get(scheduledRecapID)
        if err != nil {
            return fmt.Errorf("scheduled recap not found: %w", err)
        }
        
        // Create the actual recap (this triggers the existing recap job)
        _, appErr := app.CreateRecapFromSchedule(rctx, sr)
        if appErr != nil {
            return fmt.Errorf("failed to create recap: %w", appErr)
        }
        
        // Compute next run time
        nextRunAt, computeErr := sr.ComputeNextRunAt(time.Now())
        if computeErr != nil {
            logger.Error("Failed to compute next run", mlog.Err(computeErr))
            // Disable if can't compute next run
            storeInstance.ScheduledRecap().SetEnabled(sr.Id, false)
            return nil
        }
        
        // Update scheduled recap state (atomic via SQL expression)
        markErr := storeInstance.ScheduledRecap().MarkExecuted(sr.Id, model.GetMillis(), nextRunAt)
        if markErr != nil {
            return fmt.Errorf("failed to mark executed: %w", markErr)
        }
        
        // Handle non-recurring schedules
        if !sr.IsRecurring {
            storeInstance.ScheduledRecap().SetEnabled(sr.Id, false)
        }
        
        return nil
    }
    
    return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
```

### Pattern 3: Cluster-Safe Job Creation with Deduplication

**What:** Use `CreateJobOnce` for idempotent job creation that prevents duplicates across cluster nodes.

**When to use:** When creating jobs for scheduled items to prevent double execution.

**Example:**
```go
// Source: server/channels/store/sqlstore/job_store.go SaveOnce()
// CreateJobOnce uses serializable transaction to prevent duplicates

// In scheduler:
_, err := jobServer.CreateJobOnce(rctx, model.JobTypeScheduledRecap, jobData)
if err != nil {
    // Job might already exist - this is OK
    logger.Debug("Job creation skipped (likely already exists)", mlog.Err(err))
}
```

### Anti-Patterns to Avoid

- **Creating custom job polling loops:** Use the built-in Watcher pattern, don't create goroutines that poll Jobs table
- **Running schedulers on all nodes:** Schedulers MUST check `isLeader` - this is handled by `schedulers.go` automatically
- **Direct database updates without atomic operations:** Use `MarkExecuted` with SQL expressions for RunCount
- **Creating new job types when existing ones suffice:** Reuse `JobTypeRecap` if the worker logic is identical

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leader election | Custom cluster coordination | `HandleClusterLeaderChange()` callback | Mattermost handles this |
| Job deduplication | Check-then-insert | `CreateJobOnce()` with serializable txn | Race conditions |
| Job status tracking | Manual status updates | `ClaimJob`, `SetJobSuccess`, `SetJobError` | Atomic status transitions |
| Polling for pending jobs | Custom polling loop | Register with `JobServer` | Watcher handles this |
| Timezone-aware scheduling | Manual UTC conversion | `ScheduledRecap.ComputeNextRunAt()` | DST handling |
| Atomic counter increment | Read-modify-write | SQL expression `RunCount + 1` | Phase 1 already implemented this |

**Key insight:** Mattermost's job system handles 90% of the complexity. The only custom code needed is the logic to poll for due scheduled recaps and map them to job parameters.

## Common Pitfalls

### Pitfall 1: Scheduler Running on Non-Leader Nodes
**What goes wrong:** Duplicate jobs created from multiple nodes
**Why it happens:** Not using the standard scheduler registration pattern
**How to avoid:** Always use `RegisterJobType()` - the `Schedulers` struct checks `isLeader` before calling `ScheduleJob()`
**Warning signs:** Multiple jobs with same `scheduled_recap_id` in Jobs table

### Pitfall 2: Race Condition on RunCount Increment
**What goes wrong:** RunCount undercount when jobs execute concurrently
**Why it happens:** Using read-modify-write pattern instead of SQL expression
**How to avoid:** Phase 1 already implemented `MarkExecuted` with `sq.Expr("RunCount + 1")` - use it
**Warning signs:** RunCount doesn't match actual executions

### Pitfall 3: Polling Interval Too Short
**What goes wrong:** Database load, excessive job creation
**Why it happens:** Trying to achieve "real-time" execution
**How to avoid:** Use 1-minute polling interval (±2 minute accuracy is acceptable per requirements)
**Warning signs:** High DB query rate for GetDueBefore, many skipped jobs

### Pitfall 4: Not Handling Non-Recurring Schedules
**What goes wrong:** "Run once" schedules keep executing
**Why it happens:** Forgetting to disable after execution
**How to avoid:** Check `IsRecurring` flag, call `SetEnabled(false)` for one-time schedules
**Warning signs:** Duplicate recaps for one-time schedules

### Pitfall 5: Blocking on Recap Generation in Scheduler
**What goes wrong:** Scheduler blocks, delays other scheduled items
**Why it happens:** Trying to do work in ScheduleJob instead of just creating jobs
**How to avoid:** Scheduler only creates Job records; Worker does the actual work
**Warning signs:** Long delays between scheduled recap triggers

### Pitfall 6: Stale NextRunAt After DST Transition
**What goes wrong:** Recap fires at wrong time after DST change
**Why it happens:** Computing NextRunAt once and caching
**How to avoid:** Always compute fresh using `ComputeNextRunAt()` with current time after each execution
**Warning signs:** 1-hour shift in execution times after DST

## Code Examples

### Complete Scheduler Registration (server.go pattern)
```go
// Source: server/channels/app/server.go initJobs() pattern
s.Jobs.RegisterJobType(
    model.JobTypeScheduledRecap,
    scheduled_recap.MakeWorker(s.Jobs, s.Store(), New(ServerConnector(s.Channels()))),
    scheduled_recap.MakeScheduler(s.Jobs, s.Store()),
)
```

### Job Type Constant Definition
```go
// Source: server/public/model/job.go pattern
const (
    // ... existing constants ...
    JobTypeScheduledRecap = "scheduled_recap"
)

// Add to AllJobTypes slice for validation
var AllJobTypes = [...]string{
    // ... existing types ...
    JobTypeScheduledRecap,
}
```

### App Method to Create Recap from Schedule
```go
// Source: Based on app/recap.go CreateRecap pattern
func (a *App) CreateRecapFromSchedule(rctx request.CTX, sr *model.ScheduledRecap) (*model.Recap, *model.AppError) {
    // Resolve channel IDs based on ChannelMode
    var channelIDs []string
    if sr.ChannelMode == model.ChannelModeSpecific {
        channelIDs = sr.ChannelIds
    } else {
        // all_unreads mode: get user's channels with unread messages
        channels, err := a.GetChannelsWithUnreadForUser(rctx, sr.UserId)
        if err != nil {
            return nil, err
        }
        for _, ch := range channels {
            channelIDs = append(channelIDs, ch.Id)
        }
    }
    
    // Create recap using existing flow
    return a.createRecapInternal(rctx, sr.UserId, sr.Title, channelIDs, sr.AgentId)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom goroutine polling | Job Server + Watcher | Long-standing | Use Watcher |
| Per-node scheduling | Leader-only via `isLeader` | Long-standing | Use scheduler pattern |
| Manual status management | `ClaimJob`/`SetJobSuccess` | Long-standing | Use provided methods |

**Current in Mattermost:**
- Job system is mature and stable
- PeriodicScheduler/DailyScheduler cover most use cases
- Custom schedulers extend base schedulers for special polling logic

## Open Questions

Things that couldn't be fully resolved:

1. **New Job Type vs Reuse `JobTypeRecap`?**
   - What we know: Existing recap worker processes `recap_id`, `user_id`, `channel_ids`, `agent_id`
   - What's unclear: Whether to add `scheduled_recap_id` to existing type or create new type
   - Recommendation: Create new `JobTypeScheduledRecap` with separate worker that orchestrates the creation and then triggers the existing recap job. This keeps concerns separated.

2. **Batch Size for GetDueBefore Query**
   - What we know: Current implementation has `limit` parameter
   - What's unclear: Optimal batch size for production
   - Recommendation: Start with 100, make configurable if needed

## Sources

### Primary (HIGH confidence)
- `server/channels/jobs/schedulers.go` - Core scheduler loop, leader checking
- `server/channels/jobs/base_schedulers.go` - PeriodicScheduler, DailyScheduler implementations
- `server/channels/jobs/base_workers.go` - SimpleWorker implementation
- `server/channels/jobs/server.go` - JobServer, RegisterJobType
- `server/channels/jobs/jobs_watcher.go` - Watcher polling pattern
- `server/channels/jobs/jobs.go` - ClaimJob, SetJobSuccess, SetJobError, CreateJobOnce
- `server/channels/store/sqlstore/job_store.go` - SaveOnce serializable transaction
- `server/channels/jobs/recap/worker.go` - Existing recap worker pattern
- `server/channels/jobs/delete_expired_posts/` - Similar polling scheduler pattern
- `server/channels/jobs/post_persistent_notifications/` - Custom scheduler override example
- `server/channels/store/sqlstore/scheduled_recap_store.go` - GetDueBefore, MarkExecuted
- `server/public/model/scheduled_recap.go` - ComputeNextRunAt implementation

### Secondary (MEDIUM confidence)
- `server/channels/app/server.go` initJobs() - Job registration examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly examined codebase patterns
- Architecture: HIGH - Based on multiple existing similar implementations
- Pitfalls: HIGH - Verified against actual cluster handling code

**Research date:** Wed Jan 21 2026
**Valid until:** ~90 days (Mattermost job system is stable)
