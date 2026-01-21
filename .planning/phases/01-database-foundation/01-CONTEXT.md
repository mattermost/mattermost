# Phase 1: Database Foundation - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the data model that correctly stores user schedule intent, execution state, and timezone information. This includes:
- Database schema for scheduled recap configuration (days, time, timezone, time period)
- Database schema for schedule state (NextRunAt, LastRunAt, RunCount)
- NextRunAt computation with correct timezone/DST handling

</domain>

<decisions>
## Implementation Decisions

### OpenCode's Discretion

User chose to trust existing codebase patterns for this infrastructure phase. OpenCode has full discretion on:

- Schema design and field types
- Store layer API design
- Timezone/DST handling approach
- Test structure and coverage

**Guidance:** Follow existing Mattermost patterns for database schema and store layer. The researcher should discover how similar features (like scheduled posts, reminders, or other time-based features) structure their data models.

### Implicit Requirements (from downstream phases)

The schema must support what Phases 4 and 5 need:
- Recap name/title (shown in Scheduled tab)
- Enabled/paused state (for pause/resume functionality)
- Channel selection (specific channels vs "all unreads" mode)
- Custom instructions for the AI agent
- "Run once" vs recurring schedule distinction

</decisions>

<specifics>
## Specific Ideas

No specific requirements — follow existing Mattermost database patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-database-foundation*
*Context gathered: 2026-01-21*
