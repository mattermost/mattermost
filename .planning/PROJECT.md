# Scheduled AI Recaps

## What This Is

An expansion of Mattermost's AI Recaps feature that enables users to create recurring scheduled recaps instead of only manual one-off summaries. Users can configure recaps to run automatically (e.g., "Every weekday at 9 AM, summarize yesterday's activity in my design channels"), transforming recaps from a reactive catch-up tool into a proactive daily briefing.

## Core Value

Users receive automated AI summaries of channel activity on their schedule, eliminating the need to manually trigger recaps and ensuring they never miss important discussions.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing recap functionality -->

- ✓ User can create one-off recaps with a name — existing
- ✓ User can select specific channels for recap — existing
- ✓ User can recap all unread channels — existing
- ✓ User can select which AI agent generates the recap — existing
- ✓ User can view unread recaps — existing
- ✓ User can view read recaps — existing
- ✓ User can mark recaps as read — existing
- ✓ Recaps display channel-by-channel summaries with highlights and action items — existing
- ✓ Recap generation runs as a background job — existing

### Active

<!-- Current scope. Building toward these. -->

**Scheduling:**
- [ ] User can configure recap schedule (specific days of week)
- [ ] User can set time of day for scheduled recap
- [ ] User can select time period to cover (previous day, last 3 days, last 7 days)
- [ ] User can add custom instructions for the AI agent
- [ ] User can create immediate "run once" recaps (preserves current behavior)

**Topic-based recaps:**
- [ ] User can create recaps based on topics/ideas instead of channels
- [ ] User can enter multiple topics for a single recap

**Scheduled recap management:**
- [ ] User can view list of scheduled recaps in new "Scheduled" tab
- [ ] User can edit existing scheduled recaps
- [ ] User can pause scheduled recaps
- [ ] User can resume paused scheduled recaps
- [ ] User can delete scheduled recaps

**Backend infrastructure:**
- [ ] Database schema supports scheduled recap configuration
- [ ] Job server triggers recaps at scheduled times
- [ ] API supports CRUD operations for scheduled recaps

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Full cron expression support — Overkill for this use case; day/time picker is sufficient
- Multiple schedules per recap — Adds complexity; users can create multiple scheduled recaps instead
- Custom time periods beyond the three options — Keep it simple; covers 90% of use cases
- Real-time/push notifications when recap is ready — Existing unread badge pattern is sufficient
- Mobile-specific UI — Web-first; mobile uses responsive web view

## Context

**Existing codebase:**
- Frontend: `webapp/channels/src/components/recaps/` — recap list view
- Frontend: `webapp/channels/src/components/create_recap_modal/` — current wizard (2-3 steps)
- Backend: Recap creation API exists, job server integration exists for one-off execution
- Figma designs provided for new stepped modal wizard (5 variants: 1, 2a, 2b, 2c, 3)

**Technical environment:**
- React + TypeScript frontend with Redux state management
- Go backend with PostgreSQL database
- Mattermost job server for background task scheduling
- AI agent integration via existing "Agents Bridge" infrastructure

**User flow evolution:**
- Current: Name → Type → Channels → Submit (runs immediately)
- New: Name → Type → Source config → Schedule → Finish (creates scheduled job)

## Constraints

- **Tech stack**: Must use existing Mattermost patterns (GenericModal, compass-icons, scss modules)
- **Backwards compatibility**: Existing one-off recap flow must still work ("run once" option)
- **Feature flag**: Must be gated behind `EnableAIRecaps` feature flag (already exists)
- **Job server**: Must use existing Mattermost job server infrastructure, not external schedulers

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Day-of-week selector (not cron) | Simpler UX, covers typical use cases | — Pending |
| Three fixed time periods | Avoid complexity of custom date ranges | — Pending |
| "Scheduled" tab for management | Keeps list view clean, separates concerns | — Pending |
| "Run once" checkbox in schedule step | Preserves existing one-off behavior in unified flow | — Pending |

---
*Last updated: 2026-01-21 after initialization*
