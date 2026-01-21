---
phase: 03-scheduler-integration
plan: 01
subsystem: jobs
tags: [job-system, scheduler, worker, mattermost-jobs, scheduled-recap]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: ScheduledRecap model with ComputeNextRunAt
  - phase: 02-api-layer
    provides: ScheduledRecapStore with GetDueBefore, MarkExecuted
provides:
  - JobTypeScheduledRecap constant for job type identification
  - Scheduler that polls for due scheduled recaps
  - Worker that processes scheduled recap jobs
affects: [03-02-app-integration, recap-job-registration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PeriodicScheduler extension for custom polling
    - SimpleWorker pattern for job execution
    - CreateJobOnce for deduplication

key-files:
  created:
    - server/channels/jobs/scheduled_recap/scheduler.go
    - server/channels/jobs/scheduled_recap/worker.go
  modified:
    - server/public/model/job.go

key-decisions:
  - "Separate JobTypeScheduledRecap from JobTypeRecap for clear separation of concerns"
  - "1-minute polling interval for scheduler (SchedulerPollingInterval constant)"
  - "AppIface interface for CreateRecapFromSchedule (to be implemented in 03-02)"

patterns-established:
  - "Custom scheduler extends PeriodicScheduler, overrides ScheduleJob for polling logic"
  - "Worker checks Enabled flag before processing to handle disabled schedules"
  - "Non-recurring schedules disabled after execution via SetEnabled(false)"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 3 Plan 1: Job System Components Summary

**JobTypeScheduledRecap constant, scheduler polling GetDueBefore, and worker executing scheduled recaps with state updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T19:23:16Z
- **Completed:** 2026-01-21T19:25:56Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added JobTypeScheduledRecap constant to model/job.go and AllJobTypes slice
- Created scheduler that polls GetDueBefore every 1 minute and creates jobs with CreateJobOnce
- Created worker that executes scheduled recap, calls MarkExecuted, and disables non-recurring schedules

## Task Commits

Each task was committed atomically:

1. **Task 1: Add JobTypeScheduledRecap constant** - `00efc821f7` (feat)
2. **Task 2: Create scheduler implementation** - `91a6953335` (feat)
3. **Task 3: Create worker implementation** - `ca16007b17` (feat)

## Files Created/Modified

- `server/public/model/job.go` - Added JobTypeScheduledRecap constant and AllJobTypes entry
- `server/channels/jobs/scheduled_recap/scheduler.go` - Scheduler polling for due recaps, creates jobs
- `server/channels/jobs/scheduled_recap/worker.go` - Worker processing jobs, updating state, handling non-recurring

## Decisions Made

1. **Separate job type from existing recap jobs** - Using JobTypeScheduledRecap instead of reusing JobTypeRecap keeps scheduled recap orchestration separate from the actual recap processing
2. **1-minute polling interval** - Provides ±1 minute accuracy which is acceptable for scheduled recaps, balances responsiveness with database load
3. **AppIface interface for app dependency** - Defines CreateRecapFromSchedule method to be implemented in 03-02, follows existing worker patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Job type constant, scheduler, and worker are ready
- AppIface interface defined, waiting for 03-02 to implement CreateRecapFromSchedule
- Job registration in server.go will be done in 03-02 after app method exists
- All code compiles without errors

---
*Phase: 03-scheduler-integration*
*Completed: 2026-01-21*
