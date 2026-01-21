# Phase 1: Database Foundation - Research

**Researched:** 2026-01-21
**Domain:** Database schema design for scheduled recaps with timezone-aware scheduling
**Confidence:** HIGH

## Summary

This phase establishes the data model for scheduled recaps, which differs significantly from the existing instant Recap model. The existing `Recaps` table stores **generated recap results** (summaries, action items, etc.), while scheduled recaps need a separate table to store **schedule configuration** (when to run, which channels, timezone, etc.).

The codebase has a clear precedent in `ScheduledPosts` for one-time scheduled items. However, scheduled recaps require **recurring schedule** support (days of week + time), which doesn't exist elsewhere in the codebase. The recommended approach is to:
1. Create a new `ScheduledRecaps` table for schedule configuration
2. Store schedule intent (days, time, timezone) separately from computed NextRunAt
3. Use Go's `time.Location` for DST-aware NextRunAt computation
4. Reuse the existing Recaps table for generated outputs (linking via foreign key)

**Primary recommendation:** Create a new `ScheduledRecaps` table with IANA timezone strings, day-of-week bitmask, and computed NextRunAt field. Let the existing Recaps system handle generated outputs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `github.com/mattermost/squirrel` | existing | SQL query builder | Used by all Mattermost stores |
| `time` (stdlib) | Go stdlib | Timezone/DST handling | Go's `time.Location` with IANA zones handles DST automatically |
| `database/sql` | Go stdlib | Database interface | Standard in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `github.com/pkg/errors` | existing | Error wrapping | Wrap store errors per existing pattern |
| `encoding/json` | Go stdlib | JSON array serialization | For ChannelIds storage (array fields) |
| `server/public/shared/timezones` | existing | Timezone validation | Validate against `DefaultSupportedTimezones` list |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bitmask for days | JSON array `["Mon","Tue"]` | Bitmask is more efficient for querying, JSON more readable - **choose bitmask** for DB efficiency |
| IANA timezone string | UTC offset integer | IANA handles DST transitions automatically - **choose IANA** |
| Separate ScheduledRecaps table | Extend existing Recaps table | Clean separation of config vs results - **choose new table** |

**Installation:**
No new dependencies required - use existing codebase libraries.

## Architecture Patterns

### Recommended Schema Design

```sql
-- ScheduledRecaps table: stores scheduled recap configuration
CREATE TABLE IF NOT EXISTS ScheduledRecaps (
    Id VARCHAR(26) PRIMARY KEY,
    UserId VARCHAR(26) NOT NULL,
    Title VARCHAR(255) NOT NULL,
    
    -- Schedule configuration (user intent)
    DaysOfWeek INT NOT NULL,           -- Bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
    TimeOfDay VARCHAR(5) NOT NULL,     -- "HH:MM" format (e.g., "09:00")
    Timezone VARCHAR(64) NOT NULL,     -- IANA timezone (e.g., "America/New_York")
    TimePeriod VARCHAR(32) NOT NULL,   -- "last_24h", "last_week", "since_last_read"
    
    -- Schedule state (computed)
    NextRunAt BIGINT NOT NULL,         -- Unix milliseconds, computed from schedule + timezone
    LastRunAt BIGINT DEFAULT 0,        -- Unix milliseconds, updated after each run
    RunCount INT DEFAULT 0,            -- Number of times this schedule has executed
    
    -- Channel configuration
    ChannelMode VARCHAR(32) NOT NULL,  -- "specific" or "all_unreads"
    ChannelIds TEXT,                   -- JSON array of channel IDs (when mode = "specific")
    
    -- AI configuration
    CustomInstructions TEXT,           -- Custom AI instructions (nullable)
    AgentId VARCHAR(26) DEFAULT '',    -- AI agent to use
    
    -- Schedule type and state
    IsRecurring BOOLEAN DEFAULT true,  -- false for "run once" schedules
    Enabled BOOLEAN DEFAULT true,      -- false when paused
    
    -- Standard timestamps
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT DEFAULT 0          -- Soft delete
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_recaps_user_id ON ScheduledRecaps(UserId);
CREATE INDEX IF NOT EXISTS idx_scheduled_recaps_next_run_at ON ScheduledRecaps(NextRunAt);
CREATE INDEX IF NOT EXISTS idx_scheduled_recaps_enabled_next_run ON ScheduledRecaps(Enabled, NextRunAt) WHERE DeleteAt = 0;
CREATE INDEX IF NOT EXISTS idx_scheduled_recaps_user_delete ON ScheduledRecaps(UserId, DeleteAt);
```

### Recommended Model Structure

```go
// server/public/model/scheduled_recap.go

package model

import (
    "encoding/json"
    "time"
)

// Day-of-week bitmask constants
const (
    Sunday    = 1 << 0  // 1
    Monday    = 1 << 1  // 2
    Tuesday   = 1 << 2  // 4
    Wednesday = 1 << 3  // 8
    Thursday  = 1 << 4  // 16
    Friday    = 1 << 5  // 32
    Saturday  = 1 << 6  // 64
    
    Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday  // 62
    Weekend  = Saturday | Sunday                                  // 65
    EveryDay = Weekdays | Weekend                                 // 127
)

// Channel mode constants
const (
    ChannelModeSpecific   = "specific"
    ChannelModeAllUnreads = "all_unreads"
)

// Time period constants
const (
    TimePeriodLast24h       = "last_24h"
    TimePeriodLastWeek      = "last_week"
    TimePeriodSinceLastRead = "since_last_read"
)

type ScheduledRecap struct {
    Id                 string   `json:"id"`
    UserId             string   `json:"user_id"`
    Title              string   `json:"title"`
    
    // Schedule configuration
    DaysOfWeek         int      `json:"days_of_week"`
    TimeOfDay          string   `json:"time_of_day"`    // "HH:MM"
    Timezone           string   `json:"timezone"`       // IANA timezone
    TimePeriod         string   `json:"time_period"`
    
    // Schedule state
    NextRunAt          int64    `json:"next_run_at"`
    LastRunAt          int64    `json:"last_run_at"`
    RunCount           int      `json:"run_count"`
    
    // Channel configuration
    ChannelMode        string   `json:"channel_mode"`
    ChannelIds         []string `json:"channel_ids,omitempty"`
    
    // AI configuration
    CustomInstructions string   `json:"custom_instructions,omitempty"`
    AgentId            string   `json:"agent_id"`
    
    // State flags
    IsRecurring        bool     `json:"is_recurring"`
    Enabled            bool     `json:"enabled"`
    
    // Timestamps
    CreateAt           int64    `json:"create_at"`
    UpdateAt           int64    `json:"update_at"`
    DeleteAt           int64    `json:"delete_at"`
}
```

### Pattern 1: NextRunAt Computation with DST Handling

**What:** Compute the next scheduled run time in the user's timezone, then convert to UTC milliseconds.
**When to use:** On schedule creation and after each run completes.

```go
// ComputeNextRunAt calculates the next scheduled execution time
// Source: Go stdlib time package - handles DST automatically
func (sr *ScheduledRecap) ComputeNextRunAt(fromTime time.Time) (int64, error) {
    // Load user's timezone
    loc, err := time.LoadLocation(sr.Timezone)
    if err != nil {
        return 0, errors.Wrap(err, "invalid timezone")
    }
    
    // Parse time of day
    parts := strings.Split(sr.TimeOfDay, ":")
    if len(parts) != 2 {
        return 0, errors.New("invalid time format")
    }
    hour, _ := strconv.Atoi(parts[0])
    minute, _ := strconv.Atoi(parts[1])
    
    // Convert fromTime to user's timezone
    localNow := fromTime.In(loc)
    
    // Start searching from today
    candidate := time.Date(
        localNow.Year(), localNow.Month(), localNow.Day(),
        hour, minute, 0, 0,
        loc,
    )
    
    // If today's time has passed, start from tomorrow
    if candidate.Before(localNow) || candidate.Equal(localNow) {
        candidate = candidate.AddDate(0, 0, 1)
    }
    
    // Find next matching day of week (max 7 iterations)
    for i := 0; i < 7; i++ {
        weekday := int(candidate.Weekday()) // 0=Sunday
        dayBit := 1 << weekday
        
        if sr.DaysOfWeek & dayBit != 0 {
            // Found a matching day
            return GetMillisForTime(candidate), nil
        }
        
        candidate = candidate.AddDate(0, 0, 1)
    }
    
    return 0, errors.New("no valid day in schedule")
}
```

### Pattern 2: Store Interface for Scheduled Recaps

**What:** Store methods following existing Mattermost patterns.
**When to use:** All database operations for scheduled recaps.

```go
// server/channels/store/store.go (add to Store interface)

type ScheduledRecapStore interface {
    // CRUD operations
    Save(scheduledRecap *ScheduledRecap) (*ScheduledRecap, error)
    Get(id string) (*ScheduledRecap, error)
    Update(scheduledRecap *ScheduledRecap) (*ScheduledRecap, error)
    Delete(id string) error  // Soft delete
    
    // Query operations
    GetForUser(userId string, page, perPage int) ([]*ScheduledRecap, error)
    GetDueBefore(timestamp int64, limit int) ([]*ScheduledRecap, error)
    
    // State updates
    UpdateNextRunAt(id string, nextRunAt int64) error
    MarkExecuted(id string, lastRunAt int64, nextRunAt int64) error
    SetEnabled(id string, enabled bool) error
}
```

### Anti-Patterns to Avoid
- **Storing UTC offset instead of IANA timezone:** UTC offsets don't handle DST transitions. Always store IANA timezone strings (e.g., "America/New_York").
- **Computing NextRunAt in SQL:** SQL doesn't handle IANA timezone DST rules well. Compute in Go, store as UTC millis.
- **Mixing schedule config with execution results:** Keep ScheduledRecaps (config) separate from Recaps (results).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone validation | Custom validator | `timezones.DefaultSupportedTimezones` | Pre-built list of 500+ valid IANA zones |
| DST transitions | Manual offset tracking | `time.LoadLocation` + `time.In()` | Go stdlib handles DST automatically |
| ID generation | UUID library | `model.NewId()` | Mattermost standard 26-char IDs |
| Timestamps | `time.Now().Unix()` | `model.GetMillis()` | Consistent millisecond precision |
| JSON array storage | Custom serialization | `model.ArrayToJSON()` | Used by Posts, ScheduledPosts, Recaps |
| Query builder | Raw SQL strings | `squirrel` builder | Consistent with all stores |

**Key insight:** Go's `time` package with IANA timezone strings handles all DST complexity. The only requirement is storing the IANA string (e.g., "America/New_York") and loading it with `time.LoadLocation()`.

## Common Pitfalls

### Pitfall 1: DST Transition Edge Cases
**What goes wrong:** Schedule set for 2:30 AM in a timezone where 2:00-3:00 AM is skipped during spring DST transition.
**Why it happens:** That time literally doesn't exist on the transition day.
**How to avoid:** When `time.Date()` is called for a non-existent time, Go adjusts it forward to the next valid time. Document this behavior and test it explicitly.
**Warning signs:** Schedule runs at unexpected times in March/November.

### Pitfall 2: Day-of-Week Off-by-One
**What goes wrong:** Schedule runs on wrong days.
**Why it happens:** Confusion between Go's `time.Weekday` (Sunday=0) and other systems (Monday=0).
**How to avoid:** Use explicit constants matching Go's convention: `Sunday=1<<0, Monday=1<<1, etc.`
**Warning signs:** Saturday schedules running on Sunday.

### Pitfall 3: Timezone Validation Gap
**What goes wrong:** User submits "PST" which is not a valid IANA timezone.
**Why it happens:** Common abbreviations like "PST", "EST" are ambiguous and not IANA zones.
**How to avoid:** Validate against `timezones.DefaultSupportedTimezones` which contains only valid IANA zones.
**Warning signs:** `time.LoadLocation()` returning errors in production.

### Pitfall 4: NextRunAt Stale After System Downtime
**What goes wrong:** After server restart, NextRunAt is in the past.
**Why it happens:** Scheduled time passed while server was down.
**How to avoid:** The scheduler job should handle `NextRunAt < now` by recomputing from current time. Always update NextRunAt after execution.
**Warning signs:** Batch of schedules all running at once after restart.

## Code Examples

Verified patterns from the Mattermost codebase:

### Store Save Pattern (from recap_store.go)
```go
// Source: server/channels/store/sqlstore/recap_store.go
func (s *SqlScheduledRecapStore) Save(sr *model.ScheduledRecap) (*model.ScheduledRecap, error) {
    query := s.getQueryBuilder().
        Insert("ScheduledRecaps").
        SetMap(s.scheduledRecapToMap(sr))

    if _, err := s.GetMaster().ExecBuilder(query); err != nil {
        return nil, errors.Wrap(err, "failed to save ScheduledRecap")
    }

    return sr, nil
}
```

### Query Due Items Pattern (from scheduled_post_store.go)
```go
// Source: server/channels/store/sqlstore/scheduled_post_store.go
func (s *SqlScheduledRecapStore) GetDueBefore(timestamp int64, limit int) ([]*model.ScheduledRecap, error) {
    query := s.getQueryBuilder().
        Select(scheduledRecapColumns...).
        From("ScheduledRecaps").
        Where(sq.Eq{"Enabled": true, "DeleteAt": 0}).
        Where(sq.LtOrEq{"NextRunAt": timestamp}).
        OrderBy("NextRunAt ASC").
        Limit(uint64(limit))

    var results []*model.ScheduledRecap
    if err := s.GetReplica().SelectBuilder(&results, query); err != nil {
        return nil, errors.Wrap(err, "failed to get due scheduled recaps")
    }

    return results, nil
}
```

### Timezone Location Pattern (from user.go)
```go
// Source: server/public/model/user.go
func (u *User) GetTimezoneLocation() *time.Location {
    loc, _ := time.LoadLocation(u.GetPreferredTimezone())
    if loc == nil {
        loc = time.Now().UTC().Location()
    }
    return loc
}
```

### JSON Array Storage Pattern (from scheduled_post_store.go)
```go
// Source: server/channels/store/sqlstore/scheduled_post_store.go
// For storing []string as JSON in TEXT column
"ChannelIds": model.ArrayToJSON(sr.ChannelIds),

// For reading back
var dbRow struct {
    ChannelIds string
    // ...
}
// Then unmarshal
json.Unmarshal([]byte(dbRow.ChannelIds), &sr.ChannelIds)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UTC offset integer | IANA timezone string | Go 1.0+ | DST handled automatically |
| Cron expressions | Explicit day bitmask + time | Codebase standard | More user-friendly, easier validation |

**Deprecated/outdated:**
- Using `time.FixedZone()` for user timezones - loses DST information
- Storing offsets like "-0500" - doesn't adapt to DST changes

## Open Questions

Things that couldn't be fully resolved:

1. **Should LastGeneratedRecapId link to Recaps table?**
   - What we know: When scheduled recap runs, it creates a Recap record
   - What's unclear: Should ScheduledRecaps have a foreign key to track the most recent output?
   - Recommendation: Add `LastRecapId VARCHAR(26)` to link to most recent generated Recap

2. **How to handle "all unreads" channel mode efficiently?**
   - What we know: Need to query user's unread channels at execution time
   - What's unclear: Performance implications for users with many channels
   - Recommendation: Defer to execution layer (Phase 3), store only `channel_mode`

## Sources

### Primary (HIGH confidence)
- `server/public/model/recap.go` - Existing Recap model structure
- `server/channels/store/sqlstore/recap_store.go` - Store patterns
- `server/channels/store/sqlstore/scheduled_post_store.go` - Time-based scheduling patterns
- `server/public/shared/timezones/` - Timezone handling and validation
- `server/public/model/user.go` - GetTimezoneLocation pattern
- `server/channels/db/migrations/postgres/000149_create_recaps.up.sql` - Migration format

### Secondary (MEDIUM confidence)
- Go stdlib `time` package documentation - DST handling verified
- Existing codebase job patterns (recap/worker.go, scheduled_post_job.go)

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries exist in codebase
- Architecture: HIGH - Follows existing ScheduledPost, Recap patterns exactly
- Pitfalls: HIGH - DST handling verified with Go stdlib, timezone list exists

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (stable domain, low churn)
