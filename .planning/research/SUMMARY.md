# Research Summary: Scheduled AI Recaps

**Project:** Scheduled AI Recaps for Mattermost
**Domain:** Recurring scheduled jobs with AI summarization
**Researched:** 2026-01-21
**Confidence:** HIGH

## Executive Summary

Scheduled AI recaps require a **data-driven scheduling pattern**, not Mattermost's standard JobServer schedulers. The key insight is that Mattermost already solved this exact problem for Scheduled Posts — that implementation (`CreateRecurringTaskFromNextIntervalTime` polling pattern) should be the primary reference. The existing recap job worker can be reused for actual content generation; only the scheduling layer needs to be built.

The recommended approach stores user schedule intent (day-of-week, time, timezone) separately from pre-computed `NextRunAt` timestamps. This enables efficient database polling while preserving the ability to recalculate schedules when timezone rules change or users edit their preferences. All times must be stored in UTC with explicit timezone for user-facing display.

Critical risks center on timezone handling (DST transitions, wrong local times) and cluster coordination (duplicate execution on HA deployments). Both are mitigated by leveraging Mattermost's existing patterns: `User.GetTimezoneLocation()` for timezone handling and the `isLeader` check pattern for cluster-safe job execution. Getting the schema right in Phase 1 is essential — mistakes require data migrations.

## Key Findings

### Recommended Stack

Use Mattermost's existing infrastructure rather than building custom solutions. The ScheduledPosts implementation is the canonical reference.

**Core technologies:**
- **Go stdlib `time` package**: Timezone handling — proven, handles DST correctly when used properly
- **PostgreSQL**: Schedule persistence — BIGINT for UTC timestamps, VARCHAR for IANA timezone names
- **`CreateRecurringTaskFromNextIntervalTime`**: 1-minute polling loop — already handles cluster leader election
- **Existing `recap` JobWorker**: AI summarization — reuse, don't duplicate

**Critical version requirements:** None beyond Mattermost's existing Go 1.21+ / PostgreSQL 12+ requirements.

### Expected Features

**Must have (table stakes):**
- Day-of-week selection (checkboxes for Mon-Sun)
- Time-of-day picker with timezone display
- Timezone handling (store user timezone, display local times)
- Pause/Resume toggle (no deletion needed for temporary stops)
- Edit existing schedules (full edit, not delete+recreate)
- View scheduled recaps list with status indicators
- "Run once" option for backwards compatibility with current behavior
- Time period selection (1 day, 3 days, 7 days)
- Next run preview ("Next: Monday 9:00 AM")

**Should have (competitive):**
- Topic-based recaps (already in scope — few competitors offer this)
- Custom AI instructions (already in scope — personalize summary focus)
- AI agent selection (already exists — unique to multi-agent systems)

**Defer (v2+):**
- Recap sharing with teammates
- Smart scheduling suggestions based on channel activity
- Channel recommendations based on participation
- Catchup mode for absence detection
- Effectiveness metrics

**Anti-features (explicitly avoid):**
- Full cron expression input (too complex for users)
- Hourly/minute scheduling (recaps need time to accumulate)
- Email delivery (fragments experience)
- Complex repeat patterns (weekly is sufficient)

### Architecture Approach

The architecture extends existing Mattermost patterns: new `ScheduledRecaps` table, new store layer, a data-driven scheduler that polls for due schedules, extended API endpoints, and an enhanced frontend wizard with a "Scheduled" tab. The existing recap worker handles actual content generation unchanged.

**Major components:**
1. **ScheduledRecaps Store** — CRUD for schedule configurations, `GetDueSchedules()` for polling
2. **Scheduled Recap Processor** — 1-minute polling task, creates standard recap jobs for due schedules
3. **Enhanced Recap Worker** — Extended to handle `time_period` parameter from scheduled context
4. **API Layer** — New endpoints for scheduled recap CRUD + enable/disable/run-now
5. **Frontend Wizard** — Enhanced from 3 to 5 steps, adding schedule configuration
6. **Scheduled Tab** — New tab in recaps list for viewing/managing schedules

### Critical Pitfalls

1. **Timezone storage** — Store user intent (hour, minute, timezone string) plus pre-computed `NextRunAt` in UTC. Never store times without timezone context. Use `User.GetTimezoneLocation()`.

2. **Cluster duplicate execution** — Use existing `isLeader` check pattern or `CreateRecurringTaskFromNextIntervalTime`. Never use standalone `time.AfterFunc` for scheduled jobs.

3. **DST transitions** — Test explicitly with March/November dates. Store wall-clock time + timezone, not UTC offset. Times like 2:30 AM may not exist during spring forward.

4. **Job state lost on restart** — Persist all schedules to database. Use `NextRunAt` column for efficient polling. The ScheduledPosts pattern handles this correctly.

5. **Schema that can't express user intent** — Store original schedule configuration (days, time, timezone) not just next execution. Required for edits and timezone rule changes.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Database Foundation
**Rationale:** Everything depends on correct schema — timezone handling and job persistence must be right from the start. Mistakes require data migrations.
**Delivers:** `ScheduledRecaps` table, model, store interface, store implementation with tests
**Addresses:** Schedule storage, time period selection, pause/resume state, next run tracking
**Avoids:** Timezone storage pitfall, schema that can't express user intent

### Phase 2: API Layer
**Rationale:** Backend must be complete and testable before frontend work. Enables parallel development.
**Delivers:** CRUD endpoints, enable/disable, run-now, app layer business logic, permission checks
**Addresses:** Edit schedules, delete schedules, immediate execution option
**Avoids:** Wizard state persisted too early (API only commits on final confirmation)

### Phase 3: Scheduler Integration
**Rationale:** Core automation logic depends on stable database schema. Extends existing recap worker.
**Delivers:** Scheduled recap processor (1-minute polling), enhanced worker for time_period, next run calculation
**Uses:** `CreateRecurringTaskFromNextIntervalTime`, existing recap worker, existing AI summarization
**Avoids:** Cluster duplicate execution, job state lost on restart, DST handling bugs

### Phase 4: Frontend - Scheduled Tab
**Rationale:** Read-only view is lower risk than creation flow. Lets users manage schedules created via API/testing.
**Delivers:** Redux state for scheduled recaps, Client4 methods, scheduled_recaps_list, scheduled_recap_item, third tab
**Addresses:** View scheduled recaps list, status indicators, pause/resume/delete from UI

### Phase 5: Frontend - Enhanced Wizard  
**Rationale:** Most complex UI changes. Benefits from stable backend and existing scheduled tab for testing.
**Delivers:** schedule_configuration.tsx, topic_selector.tsx, enhanced modal flow, run-once checkbox
**Addresses:** Day-of-week selection, time picker, timezone display, custom instructions, AI agent selection

### Phase Ordering Rationale

- **Database first** because schema mistakes require migrations and all other components depend on it
- **API before frontend** enables backend testing and parallel development
- **Scheduler after API** because it creates recap jobs via the same paths
- **Scheduled tab before wizard** because viewing is simpler than creating; provides feedback loop for backend work
- **Wizard last** because it's the highest-complexity UI and benefits from everything else being stable

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Scheduler):** Verify exact ScheduledPosts pattern, understand leader election details, test DST handling
- **Phase 5 (Wizard):** May need UX research on timezone picker component selection, day-of-week picker patterns

Phases with standard patterns (skip research-phase):
- **Phase 1 (Database):** Standard Mattermost schema patterns, well-documented
- **Phase 2 (API):** Follow existing recap.go API patterns exactly
- **Phase 4 (Scheduled Tab):** Follows existing recaps_list.tsx patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase analysis of ScheduledPosts, job server |
| Features | MEDIUM | Based on competitor analysis (GitHub, Slack) + established patterns |
| Architecture | HIGH | Verified existing patterns in codebase, clear reference implementation |
| Pitfalls | HIGH | Mix of codebase patterns + established distributed systems knowledge |

**Overall confidence:** HIGH

### Gaps to Address

- **Optimal channel limit:** GitHub uses 5 repos per reminder. What's right for Mattermost? Needs user testing.
- **Job server capacity:** What's the capacity for scheduled tasks at scale? May need performance testing in Phase 3.
- **Notification pattern:** How should users be notified recap is ready? Badge only or toast? Needs UX validation.
- **Time period options:** 1/3/7 days assumed from training data. Validate with users.

## Build Order Recommendation

Based on synthesized research, the recommended build order is:

1. **Database + Model + Store** (Phase 1) — Foundation for everything
2. **API + App Layer** (Phase 2) — Enables backend testing
3. **Scheduler + Worker Enhancement** (Phase 3) — Core automation
4. **Frontend Scheduled Tab** (Phase 4) — View/manage capabilities
5. **Frontend Enhanced Wizard** (Phase 5) — Creation flow

This order minimizes rework, enables parallel testing, and tackles highest-risk (schema) decisions first.

## Open Questions

Consolidated from all research files:

1. What channel limit should be enforced per scheduled recap? (FEATURES.md gap)
2. How to handle orphaned schedules when channels are deleted? (PITFALLS.md - FK cascade behavior)
3. Should there be jitter on scheduled times to prevent thundering herd? (PITFALLS.md - job starvation)
4. What metrics should be exposed for scheduled recap health? (PITFALLS.md - observability)

## Sources

### Primary (HIGH confidence)
- `server/channels/app/scheduled_post_job.go` — Reference implementation for user-specific schedules
- `server/channels/app/server.go:1847-1858` — Job initialization pattern
- `server/channels/jobs/schedulers.go` — Leader election pattern (`isLeader` check)
- `server/public/model/scheduled_task.go` — `CreateRecurringTaskFromNextIntervalTime`
- `server/channels/store/sqlstore/recap_store.go` — Store pattern reference
- `server/channels/db/migrations/postgres/000128_create_scheduled_posts.up.sql` — Schema pattern

### Secondary (MEDIUM confidence)
- GitHub Scheduled Reminders documentation — Feature parity baseline
- Slack scheduled messages documentation — UX patterns
- Todoist recurring dates — Natural language scheduling patterns

### Tertiary (LOW confidence)
- Industry standard day/time picker UX patterns — Needs validation with design
- Digest email best practices — May not apply to in-app delivery

---
*Research completed: 2026-01-21*
*Ready for roadmap: yes*
