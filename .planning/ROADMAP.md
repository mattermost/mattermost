# Roadmap: Scheduled AI Recaps

**Created:** 2026-01-21
**Phases:** 5
**Depth:** Standard
**Requirements:** 39 v1

## Overview

This roadmap delivers scheduled AI recaps through five phases: database foundation, API layer, scheduler integration, scheduled tab UI, and enhanced wizard. The build order prioritizes getting the schema right (Phase 1), enabling backend testing (Phase 2), automating execution (Phase 3), then building frontend progressively from read (Phase 4) to write (Phase 5).

---

## Phase 1: Database Foundation

**Goal:** Establish the data model that correctly stores user schedule intent, execution state, and timezone information.

**Dependencies:** None (foundation)

**Requirements:**
- **INFRA-01**: Database schema stores scheduled recap configuration
- **INFRA-02**: Database schema stores schedule state (NextRunAt, LastRunAt, RunCount)
- **INFRA-10**: NextRunAt is computed correctly with timezone/DST handling

**Success Criteria:**
1. Developer can create a scheduled recap record with day-of-week, time, timezone, and time period
2. Developer can query for all scheduled recaps due before a given timestamp
3. NextRunAt calculation handles DST transitions correctly (tested with March/November dates)
4. Store layer has full test coverage for CRUD operations

**Plans:** 2 plans ✓
Plans:
- [x] 01-01-PLAN.md — Model + migration (ScheduledRecap struct, NextRunAt computation, database table)
- [x] 01-02-PLAN.md — Store layer (ScheduledRecapStore interface, SQL implementation, tests)

---

## Phase 2: API Layer

**Goal:** Expose scheduled recap operations via RESTful endpoints with proper authorization and validation.

**Dependencies:** Phase 1 (Database Foundation)

**Requirements:**
- **INFRA-05**: API endpoint to create scheduled recap
- **INFRA-06**: API endpoint to update scheduled recap
- **INFRA-07**: API endpoint to delete scheduled recap
- **INFRA-08**: API endpoint to pause/resume scheduled recap
- **INFRA-09**: API endpoint to list scheduled recaps

**Success Criteria:**
1. Developer can create, read, update, delete scheduled recaps via API
2. API returns 403 when user attempts to access another user's scheduled recaps
3. API validates schedule inputs (valid days, valid time, valid timezone)
4. Pause/resume endpoint toggles enabled state and recalculates NextRunAt on resume

**Plans:** 2 plans ✓
Plans:
- [x] 02-01-PLAN.md — App layer methods (CRUD + pause/resume with NextRunAt computation)
- [x] 02-02-PLAN.md — API handlers and routes (7 endpoints with auth, audit logging)

---

## Phase 3: Scheduler Integration

**Goal:** Scheduled recaps execute automatically at the correct time with cluster-safe coordination.

**Dependencies:** Phase 2 (API Layer)

**Requirements:**
- **INFRA-03**: Job server polls for and executes due scheduled recaps
- **INFRA-04**: Job execution is cluster-aware (no duplicate runs)
- **SCHED-04**: Scheduled recaps run at the correct time in user's timezone

**Success Criteria:**
1. Scheduled recaps appear in user's recap list at the scheduled time (±2 minutes)
2. Only one instance executes per scheduled recap in HA cluster deployment
3. LastRunAt and RunCount update after each execution
4. NextRunAt advances to the next scheduled occurrence after execution

**Plans:** 2 plans ✓
Plans:
- [x] 03-01-PLAN.md — Job type constant, scheduler, and worker (ScheduledRecap job infrastructure)
- [x] 03-02-PLAN.md — Job registration and App method (CreateRecapFromSchedule, initJobs wiring)

---

## Phase 4: Frontend - Scheduled Tab

**Goal:** Users can view and manage their scheduled recaps through a dedicated tab.

**Dependencies:** Phase 2 (API Layer)

**Requirements:**
- **TAB-01**: "Scheduled" tab appears alongside "Unread" and "Read" tabs
- **TAB-02**: Scheduled tab displays list of user's scheduled recaps
- **TAB-03**: Each scheduled recap shows name, schedule, status, last run, run count
- **TAB-04**: Each scheduled recap has edit action
- **TAB-05**: Each scheduled recap has pause/resume toggle
- **TAB-06**: Each scheduled recap has delete action
- **TAB-07**: Edit action opens pre-filled wizard modal
- **MGMT-01**: User can view list of scheduled recaps in "Scheduled" tab
- **MGMT-02**: User can edit an existing scheduled recap
- **MGMT-03**: User can delete a scheduled recap
- **MGMT-04**: User can pause a scheduled recap
- **MGMT-05**: User can resume a paused scheduled recap
- **MGMT-06**: User can see status indicator (active/paused) for each scheduled recap
- **MGMT-07**: User can see when scheduled recap last ran
- **MGMT-08**: User can see total run count for scheduled recap

**Success Criteria:**
1. User sees "Scheduled" tab in recaps view with count badge showing number of active schedules
2. User can pause a scheduled recap and see status change to "Paused"
3. User can delete a scheduled recap and see it removed from the list
4. User can click edit to open the wizard pre-filled with existing schedule configuration
5. Scheduled recap list shows next run time, last run time, and total run count

**Plans:** 4 plans ✓
Plans:
- [x] 04-01-PLAN.md — TypeScript types + Client4 API methods (ScheduledRecap type, 7 client methods)
- [x] 04-02-PLAN.md — Redux layer (action types, actions, reducer, selectors)
- [x] 04-03-PLAN.md — ScheduledRecapItem component (card UI with toggle, run stats, kebab menu)
- [x] 04-04-PLAN.md — Scheduled tab integration (tab UI, list, empty state)

---

## Phase 5: Frontend - Enhanced Wizard

**Goal:** Users can create and edit scheduled recaps through a multi-step wizard with schedule configuration.

**Dependencies:** Phase 4 (Scheduled Tab)

**Requirements:**
- **WIZD-01**: Step 1 shows recap name input and type selection
- **WIZD-02**: Step 2 shows channel selector (for "selected channels" type)
- **WIZD-03**: Step 2 shows unread channel list (for "all unreads" type)
- **WIZD-04**: Step 3 shows schedule configuration (day, time, period)
- **WIZD-05**: Step 3 shows "run once" checkbox option
- **WIZD-06**: Step 3 shows custom instructions textarea
- **WIZD-07**: Wizard submits and creates scheduled recap via API
- **SCHED-01**: User can select specific days of week for scheduled recap (M/T/W/Th/F/Sa/Su)
- **SCHED-02**: User can set time of day for scheduled recap delivery
- **SCHED-03**: User can select time period to cover (previous day, last 3 days, last 7 days)
- **SCHED-05**: User can create immediate "run once" recap (preserves existing behavior)
- **SCHED-06**: User can add custom instructions for the AI agent
- **SCHED-07**: User can see when scheduled recap will next run

**Success Criteria:**
1. User can complete wizard and see new scheduled recap appear in Scheduled tab
2. User can check "run once" and recap executes immediately without creating a schedule
3. User can select multiple days (e.g., Mon, Wed, Fri) and see next run calculated correctly
4. User can enter custom instructions and see them saved with the scheduled recap
5. Wizard displays next run preview before user confirms creation

**Plans:** 6 plans (2/6 complete)
Plans:
- [x] 05-01-PLAN.md — Redux actions for createScheduledRecap and updateScheduledRecap
- [x] 05-02-PLAN.md — DayOfWeekSelector component (bitmask day buttons)
- [ ] 05-03-PLAN.md — ScheduleConfiguration component (Step 3 with day/time/period/instructions)
- [ ] 05-04-PLAN.md — Run once toggle on Step 1 (RecapConfiguration)
- [ ] 05-05-PLAN.md — Modal integration (edit mode, schedule flow, submission)
- [ ] 05-06-PLAN.md — Edit wiring (pass scheduled recap to modal from Scheduled tab)

---

## Progress

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1 - Database Foundation | ✓ Complete | 3 | 3 |
| 2 - API Layer | ✓ Complete | 5 | 5 |
| 3 - Scheduler Integration | ✓ Complete | 3 | 3 |
| 4 - Scheduled Tab | ✓ Complete | 15 | 15 |
| 5 - Enhanced Wizard | 🔄 In Progress (2/6) | 13 | 0 |
| **Total** | | **39** | **26** |

---
*Roadmap created: 2026-01-21*
*Last updated: 2026-01-21 (Phase 5 plans 05-01, 05-02 complete)*
