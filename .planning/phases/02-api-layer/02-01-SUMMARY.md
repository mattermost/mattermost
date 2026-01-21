---
phase: 02-api-layer
plan: 01
subsystem: api
tags: [go, app-layer, crud, session, validation]

# Dependency graph
requires:
  - phase: 01-01
    provides: ScheduledRecap model with validation methods
  - phase: 01-02
    provides: ScheduledRecapStore interface and SQL implementation
provides:
  - App layer CRUD methods for ScheduledRecap
  - CreateScheduledRecap with session userId extraction and NextRunAt computation
  - GetScheduledRecap by ID
  - GetScheduledRecapsForUser with pagination
  - UpdateScheduledRecap with conditional NextRunAt recomputation
  - DeleteScheduledRecap soft delete
  - PauseScheduledRecap to disable schedules
  - ResumeScheduledRecap with NextRunAt recomputation before enabling
affects: [02-api-endpoints, scheduler-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App layer wraps Store calls with error handling and HTTP status codes"
    - "Session context provides authenticated user ID"
    - "Pause/Resume pattern for schedule state management"

key-files:
  created:
    - server/channels/app/scheduled_recap.go
  modified:
    - server/channels/store/retrylayer/retrylayer.go
    - server/channels/store/timerlayer/timerlayer.go

key-decisions:
  - "CreateScheduledRecap computes NextRunAt from time.Now() before saving"
  - "UpdateScheduledRecap recomputes NextRunAt only when Enabled is true"
  - "ResumeScheduledRecap recomputes NextRunAt before enabling to ensure future execution"

patterns-established:
  - "App layer method pattern: validate → compute → store → return"
  - "Error wrapping pattern: model.NewAppError with operation-specific IDs"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 02 Plan 01: ScheduledRecap App Layer Summary

**App layer CRUD and state management methods for ScheduledRecap following Mattermost patterns with session-based userId, validation, and NextRunAt computation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-21T18:52:46Z
- **Completed:** 2026-01-21T18:55:04Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created 7 App layer methods for ScheduledRecap management
- Implemented session-based user ID extraction for Create and GetForUser
- Added NextRunAt computation on Create, Update (when enabled), and Resume
- Integrated pause/resume functionality with proper state transitions
- Regenerated store layer files (retrylayer, timerlayer) for ScheduledRecapStore

## Task Commits

Each task was committed atomically:

1. **Task 1: Regenerate store mocks** - Already complete from Phase 1 (no commit needed)
2. **Task 2: Create App layer file with CRUD methods** - `634b71fdc1` (feat)
3. **Task 3: Regenerate app layer interfaces** - No interface file exists (no commit needed)

**Plan metadata:** (pending)

## Files Created/Modified

- `server/channels/app/scheduled_recap.go` - All 7 App layer methods (163 lines)
- `server/channels/store/retrylayer/retrylayer.go` - Added ScheduledRecapStore retry wrapper
- `server/channels/store/timerlayer/timerlayer.go` - Added ScheduledRecapStore timer wrapper

## Decisions Made

1. **CreateScheduledRecap sets userId from session** - Follows existing pattern in recap.go where user ID comes from authenticated session context
2. **NextRunAt computed before save/enable** - Ensures schedule always has a valid future execution time
3. **Resume recomputes NextRunAt before enabling** - If a paused schedule is resumed after its NextRunAt has passed, a new valid time must be computed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - the ScheduledRecapStore mock already existed from Phase 1, so Task 1 verified existing state rather than regenerating.

## Next Phase Readiness

- App layer complete with all CRUD and state management methods
- Ready for 02-02 (API endpoint implementation) to expose these methods via REST API
- Methods follow existing patterns and integrate with session context

---
*Phase: 02-api-layer*
*Completed: 2026-01-21*
