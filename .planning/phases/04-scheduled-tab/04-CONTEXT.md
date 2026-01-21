# Phase 4: Scheduled Tab - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view and manage their scheduled recaps through a dedicated "Scheduled" tab alongside "Unread" and "Read" tabs. This includes listing scheduled recaps, showing their status, and providing actions to edit, pause/resume, and delete them. Creating new scheduled recaps is handled in Phase 5 (Enhanced Wizard).

</domain>

<decisions>
## Implementation Decisions

### List item layout
- Card style matching the **collapsed recap card design** (Figma node `123:62940`)
- Title with emoji, subtitle showing schedule info, action button in top right
- Subtitle displays **both** schedule pattern and next run: "Weekdays at 9:00 AM · Next: Wed Jan 22"
- **Pill toggle** for active/paused status (look for existing toggle components) — interactive, flipping updates backend
- **Run stats** (last run, run count) hidden by default, **revealed on hover**
- **Kebab menu (⋮)** in top right opens overflow menu with Edit and Delete actions

### Actions UX
- **Pause/resume toggle:** Instant toggle flip + toast confirmation ("Schedule paused" / "Schedule resumed")
- **Delete:** Requires **confirm dialog** before deletion (look for existing dialog components)
- **Edit:** Opens **modal overlay** (same pattern as create wizard — maximize component reuse)
- **After edit success:** Close modal, update card in list with new values, toast confirms change

### Schedule display format
- **Smart groupings** when applicable: "Weekdays", "Every day", "Weekends"
- Otherwise **abbreviated days**: "Mon, Wed, Fri"
- All day/schedule strings require **i18n keys** in `webapp/channels/src/i18n/en.json`
- **Time format:** Respect user's locale preference, **12-hour format as default**
- **Next run display:** Smart mix — relative for <7 days ("Tomorrow", "Monday at 9:00 AM"), absolute beyond ("Jan 29 at 9:00 AM")
- **Paused schedules:** Hide next run entirely (only show schedule pattern)

### Empty state
- Follow **Figma empty state design** (node `123:19772`): illustration + heading + description + CTA button
- Heading: "Set up your first recap"
- Description: "Copilot recaps help you get caught up quickly on discussions that are most important to you with a summarized report."
- CTA: "Create a recap" button opens **wizard modal** (same as main create action)
- This empty state is **Scheduled tab specific** (Read and Unread have their own)
- When all recaps are paused: Show **normal list** with paused status, no special state

### OpenCode's Discretion
- Exact hover interaction for revealing run stats
- Loading skeleton design while fetching scheduled recaps
- Toast message exact wording
- Error state handling for failed API calls

</decisions>

<specifics>
## Specific Ideas

### Figma References
- **Collapsed recap card:** Figma node `123:62940` — use this as the template for scheduled recap list items
- **Empty state:** Figma node `123:19772` — illustration with chat/calendar/newspaper icons, heading, description, CTA

### Component Reuse Priority
- **Critical:** Reuse existing collapsed recap card component structure
- Look for existing **pill toggle** component for active/paused state
- Look for existing **confirm dialog** component for delete confirmation
- Reuse existing **modal** component for edit wizard overlay
- Reuse existing **toast** component for action confirmations
- Reuse existing **kebab menu / overflow menu** component

### i18n Requirements
- Day abbreviations need localization: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Smart groupings need localization: "Weekdays", "Weekends", "Every day"
- Schedule pattern format: "{days} at {time}"
- Next run format: "Next: {relative_or_absolute_date}"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-scheduled-tab*
*Context gathered: 2026-01-21*
