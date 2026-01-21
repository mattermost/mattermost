# Pitfalls Research: Scheduled Recaps

**Domain:** Scheduled recurring jobs in a distributed application
**Researched:** Jan 21, 2026
**Context:** Adding scheduled recurring recaps to Mattermost

## Executive Summary

Scheduled job systems appear deceptively simple but contain numerous subtle failure modes. The most critical pitfalls fall into five categories: timezone handling, job reliability across server restarts, database design, UX complexity, and operational concerns. This research documents common mistakes with actionable prevention strategies.

---

## Timezone Pitfalls

### CRITICAL: Storing Schedule Times in Server Timezone

**What goes wrong:** Schedule stored as "9:00 AM" without timezone context. User in Tokyo sets recap for 9 AM, server in UTC stores "9:00", user receives recap at 6 PM local time.

**Why it happens:** Developers test in single timezone, default to server time for simplicity.

**Warning signs:**
- Schedule table has `TIME` column without timezone offset
- Code uses `time.Now()` without explicit timezone
- Tests only pass when run in specific timezones

**Prevention:**
- ALWAYS store schedules in UTC internally
- Store user's preferred timezone separately
- Calculate next run time by converting user's local time to UTC
- Mattermost already has `User.GetTimezoneLocation()` and `GetPreferredTimezone()` - USE THEM

**Phase to address:** Phase 1 (schema design) - getting this wrong requires data migration

**Mattermost-specific note:** Existing `server/public/model/user.go` line 923-924 shows the pattern:
```go
func (u *User) GetTimezoneLocation() *time.Location {
    loc, _ := time.LoadLocation(u.GetPreferredTimezone())
```

---

### CRITICAL: DST Transition Handling

**What goes wrong:** User schedules daily recap at 2:30 AM. On DST "spring forward" day, 2:30 AM doesn't exist. System either:
- Crashes/errors
- Skips the recap entirely
- Runs twice (on "fall back" day)

**Why it happens:** Testing never covers DST edge cases; `time.LoadLocation` silently handles invalid times differently than expected.

**Warning signs:**
- Bug reports spike in March/November
- No explicit handling of "invalid local time" scenarios
- Unit tests mock time without timezone considerations

**Prevention:**
```go
// WRONG: User wants 2:30 AM in America/New_York
scheduledTime := time.Date(2026, 3, 9, 2, 30, 0, 0, loc) // Doesn't exist!

// RIGHT: Use wall clock intention, let Go adjust
// Store: hour=2, minute=30, timezone="America/New_York"
// At runtime: find next valid occurrence
```

**Detection:** Add automated tests with DST transition dates for major timezones:
- US: March 2nd Sunday, November 1st Sunday
- EU: Last Sunday of March/October
- Australia: First Sunday of April/October (reversed!)

**Phase to address:** Phase 1 (model design) - must decide wall-clock vs instant storage

---

### MODERATE: Timezone Data Updates

**What goes wrong:** Go's timezone database is embedded at compile time. Country changes timezone rules (happens ~yearly somewhere), but deployed binary has stale data.

**Prevention:**
- In production, set `ZONEINFO` environment variable to system tzdata
- Monitor for timezone database updates
- Document timezone data source in deployment docs

**Phase to address:** Phase 3 (deployment) - operational concern

---

### MODERATE: "Every Day at X" Ambiguity

**What goes wrong:** User selects "every day at 9 AM." Does this mean:
- Every 24 hours from first run?
- 9 AM in their current timezone?
- 9 AM in their profile timezone (which might differ)?
- What if they travel?

**Prevention:**
- Be explicit in UI: "9:00 AM (America/New_York)"
- Use profile timezone as default, allow override
- Show next 3 scheduled times in confirmation UI

**Phase to address:** Phase 2 (UX design)

---

## Job Server Pitfalls

### CRITICAL: Job State Lost on Restart

**What goes wrong:** Jobs scheduled in memory are lost when server restarts. Scheduled recap at 9 AM, server restarts at 8:59 AM, recap never runs.

**Why it happens:** Using in-memory timers without persistence; assuming servers never restart.

**Warning signs:**
- Jobs use `time.AfterFunc` without database backup
- No "pending jobs" recovery on startup
- Jobs disappear after deployment

**Prevention:**
- Persist ALL scheduled jobs to database
- On startup, reload pending jobs and reschedule
- Mattermost pattern: see `server/public/pluginapi/cluster/job_once.go`:
  ```go
  // On startup, jobs are rescheduled from DB:
  err = s.scheduleNewJobsFromDB()
  ```

**Phase to address:** Phase 1 - core architecture decision

---

### CRITICAL: Duplicate Execution in HA/Cluster

**What goes wrong:** Three app servers all have the same scheduled job. Job fires on all three, user gets three recap messages.

**Why it happens:** Each server independently schedules jobs; no coordination.

**Warning signs:**
- `time.AfterFunc` or cron running on every instance
- No leader election or distributed lock
- Customer complaints about duplicate notifications

**Prevention (Mattermost-specific):**

Mattermost already solves this with `isLeader` check in `server/channels/jobs/schedulers.go`:
```go
if scheduler == nil || !schedulers.isLeader || !scheduler.Enabled(cfg) {
    continue
}
```

Use the existing job scheduler infrastructure:
1. Implement `Scheduler` interface from `server/einterfaces/jobs/scheduler.go`
2. Register with `Schedulers.AddScheduler()`
3. Let framework handle leader election

**Alternative:** Use `cluster.Mutex` from `server/public/pluginapi/cluster/` for distributed locking if building custom solution.

**Phase to address:** Phase 1 - must use cluster-aware scheduling from start

---

### CRITICAL: Transactional Commit Problem (Job + State)

**What goes wrong:** System does:
1. Update database: mark recap as "scheduled to send"
2. Queue job to send recap
3. Server crashes between steps

Result: Database says recap sent, but it wasn't. OR recap sends but database doesn't record it, causing duplicate on retry.

**Why it happens:** Database and job queue are separate systems without atomic commit.

**Prevention (from Brandur's "Transactionally Staged Job Drains"):**

Use the "outbox pattern":
1. In single transaction: write job to `staged_jobs` table + update state
2. Separate process reads `staged_jobs`, executes, then deletes
3. If crash after execution but before delete, job is idempotent

```sql
-- In single transaction:
INSERT INTO staged_jobs (job_type, payload) VALUES ('send_recap', {...});
UPDATE recap_schedules SET last_scheduled_at = NOW() WHERE id = ?;
COMMIT;
```

**Phase to address:** Phase 1 - affects job execution architecture

---

### MODERATE: Job Starvation Under Load

**What goes wrong:** 10,000 recaps scheduled for 9 AM. System can only process 100/minute. Last user gets recap at 10:40 AM.

**Warning signs:**
- SLA violations increase with user count
- Popular times (9 AM, end of day) show degraded performance
- Job queue depth grows unboundedly

**Prevention:**
- Spread scheduling with jitter: `scheduledTime + random(0, 5min)`
- Rate limit per user/team
- Use priority queues for time-sensitive jobs
- Monitor job queue depth, alert when > threshold

Mattermost already adds jitter in `job_once.go`:
```go
const scheduleOnceJitter = 100 * time.Millisecond

func addJitter() time.Duration {
    return time.Duration(rand.Int63n(int64(scheduleOnceJitter)))
}
```

Consider larger jitter (minutes, not milliseconds) for user-facing schedules.

**Phase to address:** Phase 2 (scaling) - can add jitter later, but harder to change schema

---

### MODERATE: Clock Drift / NTP Issues

**What goes wrong:** Server clock drifts; scheduled 9:00 AM job runs at 9:03 AM. Or worse: clock jumps backward, job runs twice.

**Prevention:**
- Use NTP on all servers (standard practice)
- Never rely on `time.Now()` for "has enough time passed" - use monotonic clock or explicit sequence numbers
- Mattermost jobs use `LastSuccessfulJob` timestamp comparison - good pattern
- Add monitoring for clock skew between servers

**Phase to address:** Phase 3 (operations)

---

## Database Pitfalls

### CRITICAL: Schema That Can't Express User Intent

**What goes wrong:** Schema stores `next_run_time TIMESTAMP` but no information about original schedule. When timezone rules change or user edits, you can't recalculate.

**Prevention - store user intent, not just next execution:**

```sql
CREATE TABLE recap_schedules (
    id UUID PRIMARY KEY,
    user_id VARCHAR(26) NOT NULL,
    channel_id VARCHAR(26) NOT NULL,
    
    -- User's intent (what they configured)
    schedule_hour INT NOT NULL,        -- 0-23 in user's timezone
    schedule_minute INT NOT NULL,      -- 0-59
    schedule_timezone VARCHAR(64) NOT NULL,  -- "America/New_York"
    schedule_days INT NOT NULL,        -- bitmask: 1=Mon, 2=Tue, 4=Wed...
    
    -- Computed for efficient queries
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- State
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, deleted
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for finding jobs to run
CREATE INDEX idx_recap_schedules_next_run 
    ON recap_schedules(next_run_at) 
    WHERE status = 'active';
```

**Phase to address:** Phase 1 - foundational

---

### MODERATE: Missing Indexes for Job Polling

**What goes wrong:** Job scheduler queries `SELECT * FROM jobs WHERE next_run < NOW()` every minute. Without index, full table scan on millions of rows.

**Prevention:**
- Index on `next_run_at` filtered by `status = 'active'`
- Consider partitioning by time for very large tables
- Monitor query performance from day 1

**Phase to address:** Phase 1 (schema)

---

### MODERATE: Soft Delete Confusion

**What goes wrong:** User deletes schedule. System soft-deletes with `deleted_at = NOW()`. Job scheduler still finds and runs it because query doesn't filter deleted.

**Prevention:**
- Use status enum (`active`, `paused`, `deleted`) instead of nullable timestamp
- Every query includes `WHERE status = 'active'`
- Consider actually deleting with retention in audit log

**Phase to address:** Phase 1 (schema design)

---

### LOW: Foreign Key Cascades Deleting Schedules

**What goes wrong:** Channel is deleted, cascade deletes all recap schedules without notifying users.

**Prevention:**
- Use `ON DELETE SET NULL` or `ON DELETE RESTRICT`
- Handle orphaned schedules explicitly (notify user, pause schedule)
- Add trigger or application logic to handle parent deletion

**Phase to address:** Phase 1 (schema)

---

## UX Pitfalls

### CRITICAL: Wizard State Management Complexity

**What goes wrong:** Multi-step wizard for schedule creation. User goes back and forth, creates partial state, abandons wizard. Database has zombie draft schedules.

**Prevention:**
- Don't persist until final confirmation
- Use ephemeral state (React state, session storage) for wizard progress
- If must persist drafts: add `draft` status, cleanup job for old drafts

**Warning signs:**
- Multiple API calls during wizard
- `created_at` timestamps but no actual scheduled runs
- Users report "ghost" schedules they can't delete

**Phase to address:** Phase 2 (UX implementation)

---

### MODERATE: Timezone Picker UX

**What goes wrong:** 
- Dropdown with 400 timezone options overwhelms users
- User can't find their timezone (is it "America/New_York" or "US/Eastern"?)
- User selects wrong timezone, doesn't notice until recap arrives at wrong time

**Prevention:**
- Default to user's profile timezone
- Show current local time as confirmation: "9:00 AM (currently 3:42 PM in your timezone)"
- Group timezones by region
- Support search/autocomplete
- Show example: "Your next recap will be: Tuesday, Jan 21 at 9:00 AM"

**Phase to address:** Phase 2 (UX)

---

### MODERATE: Paused vs Deleted Confusion

**What goes wrong:** User wants to temporarily stop recaps. Only option is delete. User deletes, then wants to restore - configuration is gone.

**Prevention:**
- Distinct "pause" and "delete" actions
- Pause preserves all settings
- Delete requires confirmation with "are you sure?"
- Consider "soft delete" with ability to restore within X days

**Phase to address:** Phase 2 (UX design)

---

### LOW: No Feedback After Schedule Creation

**What goes wrong:** User creates schedule, modal closes, no confirmation. User unsure if it worked.

**Prevention:**
- Success toast: "Recap scheduled for 9:00 AM every weekday"
- Show next occurrence: "First recap: Tomorrow at 9:00 AM"
- Add schedule to visible list immediately

**Phase to address:** Phase 2 (UX)

---

## Operational Pitfalls

### MODERATE: No Observability

**What goes wrong:** Recaps stop being sent. No one notices for days. Can't determine if problem is scheduling, sending, or content generation.

**Prevention:**
- Metrics: jobs_scheduled, jobs_executed, jobs_failed (by type)
- Logs: structured logging with correlation IDs
- Dashboard: job queue depth, execution latency, error rate
- Alerting: zero executions in last hour when jobs are scheduled

**Phase to address:** Phase 3 (operations)

---

### MODERATE: No Rate Limiting

**What goes wrong:** Bug or abuse creates 100,000 scheduled jobs. System overwhelmed.

**Prevention:**
- Per-user limit on active schedules (e.g., max 10 per user)
- Global rate limit on job creation API
- Alert on unusual creation patterns

**Phase to address:** Phase 2 (hardening)

---

### LOW: Resource Exhaustion from Long-Running Jobs

**What goes wrong:** Recap generation takes 30 seconds per schedule. 1000 schedules at 9 AM = 8+ hours to complete.

**Prevention:**
- Timeout per job (e.g., 60 seconds max)
- Parallelize with bounded worker pool
- Degrade gracefully: partial recap better than no recap
- Pre-compute expensive data where possible

**Phase to address:** Phase 2 (performance)

---

## Prevention Checklist

Before each phase, verify:

### Phase 1: Schema & Architecture
- [ ] Schedule stores user intent (time, timezone, days) not just next_run
- [ ] All times stored in UTC with explicit timezone for user intent
- [ ] Job persistence to database (not just in-memory)
- [ ] Cluster-aware execution (leader election or distributed lock)
- [ ] Indexes on job lookup queries
- [ ] Foreign key behavior on parent deletion defined

### Phase 2: Implementation
- [ ] DST edge cases tested (spring forward, fall back)
- [ ] Wizard state is ephemeral until confirmation
- [ ] Timezone picker shows current time confirmation
- [ ] Pause and delete are separate operations
- [ ] Jitter added to scheduled times to prevent thundering herd
- [ ] Rate limits on schedule creation
- [ ] Job execution timeout defined

### Phase 3: Operations
- [ ] Metrics exported for job execution
- [ ] Alerting on missed executions
- [ ] Clock sync (NTP) verified on all servers
- [ ] Timezone database updates documented
- [ ] Recovery procedure documented (what if job queue backs up?)

---

## Sources

| Topic | Source | Confidence |
|-------|--------|------------|
| Transactional job patterns | Brandur.org "Job Drain" article | HIGH |
| Temporal workflow principles | temporal.io/blog | HIGH |
| Mattermost job scheduler | Codebase: server/channels/jobs/schedulers.go | HIGH |
| Mattermost cluster jobs | Codebase: server/public/pluginapi/cluster/ | HIGH |
| Mattermost timezone handling | Codebase: server/public/shared/timezones/ | HIGH |
| DST handling pitfalls | Professional experience, Go documentation | MEDIUM |
| Exactly-once delivery | Segment Engineering blog | HIGH |
| UX wizard patterns | General software engineering practice | MEDIUM |

---

## Summary

The highest-risk pitfalls for scheduled recaps in Mattermost are:

1. **Timezone storage** - Getting schema wrong requires migration
2. **Cluster execution** - Must use Mattermost's leader election from start
3. **Job persistence** - In-memory-only scheduling will lose jobs on restart
4. **DST handling** - Often forgotten until bug reports in March/November

Mattermost's existing job infrastructure (`jobs/schedulers.go`, `pluginapi/cluster`) provides solid foundations - the key is using them correctly rather than building custom solutions.
