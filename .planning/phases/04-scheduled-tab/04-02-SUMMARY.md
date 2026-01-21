---
phase: 04-scheduled-tab
plan: 02
subsystem: ui
tags: [redux, typescript, scheduled-recaps, state-management]

# Dependency graph
requires:
  - phase: 04-01
    provides: ScheduledRecap TypeScript types and Client4 API methods
provides:
  - Redux action types for scheduled recap CRUD operations
  - Redux actions for fetching, pausing, resuming, and deleting scheduled recaps
  - Reducer handling for scheduled recaps state
  - Selectors for accessing scheduled recaps from Redux state
affects: [04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redux async actions with error handling pattern"
    - "Memoized selectors for filtered scheduled recap lists"

key-files:
  created: []
  modified:
    - webapp/channels/src/packages/mattermost-redux/src/action_types/recaps.ts
    - webapp/channels/src/packages/mattermost-redux/src/actions/recaps.ts
    - webapp/channels/src/packages/mattermost-redux/src/reducers/entities/recaps.ts
    - webapp/channels/src/packages/mattermost-redux/src/selectors/entities/recaps.ts
    - webapp/platform/types/src/store.ts

key-decisions:
  - "Follow existing recap Redux pattern for consistency"
  - "Use Record<string, ScheduledRecap> for scheduledRecaps state"

patterns-established:
  - "Scheduled recap Redux layer follows same pattern as regular recaps"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 4 Plan 2: Redux Store and Actions Summary

**Redux action types, async actions, reducer, and selectors for scheduled recap state management**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T19:42:46Z
- **Completed:** 2026-01-21T19:45:26Z
- **Tasks:** 5
- **Files modified:** 5

## Accomplishments

- Added 15 new action type constants for scheduled recap operations
- Implemented 4 async Redux actions: getScheduledRecaps, pauseScheduledRecap, resumeScheduledRecap, deleteScheduledRecap
- Extended recaps reducer to handle scheduled recap state with RECEIVED and DELETE actions
- Created 5 selectors for accessing scheduled recaps including filtered views (active/paused)
- Updated GlobalState type to include scheduledRecaps field

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scheduled recap action types** - `6b09b4ecb4` (feat)
2. **Task 2: Add scheduled recap Redux actions** - `3f99c20578` (feat)
3. **Task 3: Add scheduled recaps to reducer** - `45abf5f8bb` (feat)
4. **Task 4: Add scheduled recap selectors** - `09e22a8e78` (feat)
5. **Task 5: Update GlobalState type for scheduled recaps** - `ceabb87d00` (feat)

## Files Created/Modified

- `webapp/channels/src/packages/mattermost-redux/src/action_types/recaps.ts` - Added 15 scheduled recap action type constants
- `webapp/channels/src/packages/mattermost-redux/src/actions/recaps.ts` - Added 4 async action creators for scheduled recaps
- `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/recaps.ts` - Extended state and reducer for scheduled recaps
- `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/recaps.ts` - Added 5 selectors for scheduled recaps
- `webapp/platform/types/src/store.ts` - Added scheduledRecaps to GlobalState recaps entity

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Follow existing recap Redux pattern | Consistency with codebase conventions; same error handling, dispatch patterns |
| Use Record<string, ScheduledRecap> for state | Simple lookup by ID, consistent with other entity state patterns |
| Separate RECEIVED_SCHEDULED_RECAP vs RECEIVED_SCHEDULED_RECAPS | Single vs bulk operations have different reducer handling |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Redux layer complete for scheduled recaps
- Components can now dispatch getScheduledRecaps() and use useSelector(getAllScheduledRecaps)
- Ready for 04-03-PLAN.md (ScheduledRecapListItem component)

---
*Phase: 04-scheduled-tab*
*Completed: 2026-01-21*
