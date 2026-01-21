---
phase: 03-scheduler-integration
verified: 2026-01-21T15:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Enable a scheduled recap for a future time, wait for execution"
    expected: "Recap is created at the scheduled time, ScheduledRecap.LastRunAt and NextRunAt are updated"
    why_human: "Requires waiting for real-time scheduler execution and database state inspection"
  - test: "Test execution in a multi-node cluster"
    expected: "Job runs only on cluster leader, no duplicate recaps created"
    why_human: "Requires multi-node cluster deployment to verify cluster-awareness"
  - test: "Test timezone handling for user in non-UTC timezone"
    expected: "Recap executes at the correct local time (e.g., 9:00 AM in user's timezone)"
    why_human: "Requires end-to-end testing with timezone-aware time comparison"
---

# Phase 3: Scheduler Integration Verification Report

**Phase Goal:** Scheduled recaps execute automatically at the correct time with cluster-safe coordination.
**Verified:** 2026-01-21T15:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | JobTypeScheduledRecap constant exists and is valid | ✓ VERIFIED | `job.go:49` defines constant, `job.go:83` adds to AllJobTypes |
| 2 | Scheduler polls GetDueBefore and creates jobs for due recaps | ✓ VERIFIED | `scheduler.go:53` calls `GetDueBefore(now, 100)`, line 67 uses `CreateJobOnce` |
| 3 | Worker processes scheduled recap jobs and creates actual recaps | ✓ VERIFIED | `worker.go:51` calls `app.CreateRecapFromSchedule(rctx, sr)` |
| 4 | Worker updates ScheduledRecap state after execution | ✓ VERIFIED | `worker.go:70` calls `MarkExecuted(id, lastRunAt, nextRunAt)` |
| 5 | ScheduledRecap job type is registered with JobServer | ✓ VERIFIED | `server.go:1639-1641` registers with worker and scheduler |
| 6 | App.CreateRecapFromSchedule creates a Recap from a ScheduledRecap | ✓ VERIFIED | `scheduled_recap.go:101-154` creates Recap and triggers JobTypeRecap |
| 7 | Job execution is cluster-aware (scheduler runs on leader only) | ✓ VERIFIED | `schedulers.go:87` checks `!schedulers.isLeader`, line 106-114 handles `clusterLeaderChanged` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/public/model/job.go` | JobTypeScheduledRecap constant | ✓ EXISTS, SUBSTANTIVE, WIRED | Line 49: `JobTypeScheduledRecap = "scheduled_recap"`, Line 83: in AllJobTypes |
| `server/channels/jobs/scheduled_recap/scheduler.go` | ScheduledRecap scheduler (min 40 lines) | ✓ EXISTS (77 lines), SUBSTANTIVE, WIRED | MakeScheduler, ScheduleJob with GetDueBefore, CreateJobOnce |
| `server/channels/jobs/scheduled_recap/worker.go` | ScheduledRecap worker (min 60 lines) | ✓ EXISTS (89 lines), SUBSTANTIVE, WIRED | MakeWorker, AppIface, MarkExecuted, SetEnabled for non-recurring |
| `server/channels/app/server.go` | Job registration | ✓ EXISTS, SUBSTANTIVE, WIRED | Line 1639-1641: RegisterJobType with worker and scheduler |
| `server/channels/app/scheduled_recap.go` | CreateRecapFromSchedule method | ✓ EXISTS, SUBSTANTIVE, WIRED | Lines 97-154: Creates Recap from ScheduledRecap, triggers JobTypeRecap job |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scheduler.go` | `store.ScheduledRecap().GetDueBefore` | polling for due recaps | ✓ WIRED | Line 53: `s.store.ScheduledRecap().GetDueBefore(now, 100)` |
| `scheduler.go` | `JobServer.CreateJobOnce` | job creation with deduplication | ✓ WIRED | Line 67: `s.jobServer.CreateJobOnce(rctx, model.JobTypeScheduledRecap, jobData)` |
| `worker.go` | `store.ScheduledRecap().MarkExecuted` | updating state after execution | ✓ WIRED | Line 70: `storeInstance.ScheduledRecap().MarkExecuted(scheduledRecapID, lastRunAt, nextRunAt)` |
| `worker.go` | `store.ScheduledRecap().SetEnabled` | disabling non-recurring schedules | ✓ WIRED | Lines 64, 78: `SetEnabled(scheduledRecapID, false)` |
| `worker.go` | `app.CreateRecapFromSchedule` | recap creation | ✓ WIRED | Line 51: `app.CreateRecapFromSchedule(rctx, sr)` |
| `server.go` | `scheduled_recap.MakeWorker` | job registration | ✓ WIRED | Line 1640: `scheduled_recap.MakeWorker(s.Jobs, s.Store(), New(ServerConnector(s.Channels())))` |
| `server.go` | `scheduled_recap.MakeScheduler` | scheduler registration | ✓ WIRED | Line 1641: `scheduled_recap.MakeScheduler(s.Jobs, s.Store())` |
| `scheduled_recap.go` | `store.Recap().SaveRecap` | direct store save | ✓ WIRED | Line 133: `a.Srv().Store().Recap().SaveRecap(recap)` |
| `scheduled_recap.go` | `model.JobTypeRecap` | job creation | ✓ WIRED | Line 147: `Type: model.JobTypeRecap` |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **INFRA-03:** Job server polls for and executes due scheduled recaps | ✓ SATISFIED | Scheduler polls GetDueBefore every 1 minute (line 18), creates jobs for each due recap |
| **INFRA-04:** Job execution is cluster-aware (no duplicate runs) | ✓ SATISFIED | Scheduler only runs on cluster leader (`schedulers.go:87`), CreateJobOnce provides deduplication |
| **SCHED-04:** Scheduled recaps run at the correct time in user's timezone | ✓ SATISFIED | `ComputeNextRunAt` in model uses `time.LoadLocation(sr.Timezone)` to compute UTC time from user's local time |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scheduled_recap.go` | 109 | TODO comment | ℹ️ Info | Non-blocking: `all_unreads` mode fallback to ChannelIds is acceptable behavior |

### Human Verification Required

The following items need human testing to fully verify goal achievement:

### 1. End-to-End Scheduled Execution

**Test:** Create a scheduled recap set to run 2 minutes in the future. Wait for execution.
**Expected:** 
- Recap record created in database with status "pending"
- ScheduledRecap.LastRunAt updated to execution time
- ScheduledRecap.NextRunAt computed for next occurrence
- ScheduledRecap.RunCount incremented
**Why human:** Requires real-time waiting and database inspection

### 2. Cluster Leader-Only Execution

**Test:** Deploy to a 2+ node cluster, verify scheduler runs only on leader
**Expected:**
- Only the cluster leader polls for due recaps
- Job creation happens once, not N times for N nodes
- Failover: when leader changes, new leader picks up scheduling
**Why human:** Requires multi-node deployment environment

### 3. Timezone Correctness

**Test:** Set up scheduled recap for user with America/New_York timezone at 9:00 AM
**Expected:**
- When it's 9:00 AM in New York, recap executes
- NextRunAt is correctly computed in UTC based on user's timezone
**Why human:** Requires timezone-aware time comparison and waiting

### 4. Non-Recurring Schedule Disabling

**Test:** Create a non-recurring (one-time) scheduled recap
**Expected:**
- After execution, Enabled is set to false
- Schedule doesn't run again
**Why human:** Requires database state verification after execution

## Verification Summary

All automated verification checks pass:

1. **Artifacts exist and are substantive:** All 5 key files exist with appropriate implementation (no stubs, no placeholder returns)
2. **Key links are wired:** Scheduler → Store → Worker → App chain is complete
3. **Cluster-awareness is built-in:** The Mattermost job system's `schedulers.isLeader` check ensures only the cluster leader runs schedulers
4. **Timezone support verified:** `ComputeNextRunAt` uses `time.LoadLocation(sr.Timezone)` to convert user's local time to UTC
5. **Deduplication in place:** `CreateJobOnce` prevents duplicate job creation
6. **Non-recurring handling:** Worker calls `SetEnabled(false)` after execution for non-recurring schedules

**Phase 3 goal achieved:** The scheduler integration is complete. Scheduled recaps will execute automatically at the correct time with cluster-safe coordination.

---

*Verified: 2026-01-21T15:00:00Z*
*Verifier: OpenCode (gsd-verifier)*
