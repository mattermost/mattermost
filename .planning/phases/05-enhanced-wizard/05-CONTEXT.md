# Phase 5: Enhanced Wizard - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create and edit scheduled recaps through a multi-step wizard with schedule configuration. The existing modal is already structured for multi-step flow. "All unreads" type skips channel selector entirely — channels are resolved at generation time, not selection time.

</domain>

<decisions>
## Implementation Decisions

### "Run once" behavior
- Toggle appears near the "Next" button on Step 1, labeled "Run once"
- When checked: Step 2 (channels) becomes the final step — skip schedule configuration entirely
- When unchecked: Normal flow continues to Step 3 (schedule config)
- After "run once" submission: Close modal, redirect to unread recaps page, show loading state while recap generates (mirrors current immediate recap behavior)

### Edit mode pre-fill
- User lands on Step 1 with all fields pre-filled from existing scheduled recap
- Modal title changes to "Edit your recap" (instead of "Set up your recap")
- Recap type is fully editable — user can switch between "selected channels" and "all unreads"
- "Run once" toggle is hidden in edit mode — editing a schedule means it's already recurring

### Next run preview
- Appears on Step 3, below day/time selectors, above "Select a time period" section
- Styled as helper text (same style as "Recap content posted up to 2 weeks" subtext)
- Updates in real-time as user changes day/time selections
- Format: Relative when applicable ("Tomorrow at 9:00 AM (EST)"), otherwise specific date with timezone
- Only appears once at least one day is selected — no placeholder text
- Always includes timezone abbreviation

### Validation & errors
- Validation fires on blur for each field
- Required fields: Name, Type, Channel(s) (if "selected channels" type), Day(s) (for scheduled), Time, Time period (defaults to "Previous day")
- Optional: Custom instructions
- Use existing form components which have error states built in (red outline + red message underneath)
- On "Next" click with validation errors: Block navigation, stay on current step, show errors on all invalid fields

### OpenCode's Discretion
- Exact component choices (leverage existing codebase components)
- Loading states and transitions between steps
- Specific error message wording
- Time picker format details (12h vs 24h based on locale)

</decisions>

<specifics>
## Specific Ideas

- Figma designs: https://www.figma.com/design/lRCkQjEI8EUgCPIqSyrwyg/AI-Recaps?node-id=123-62303&m=dev (Step 1) and node-id=123-61641 (Step 3 schedule config)
- Existing modal is already multi-step structured — extend it, don't rebuild
- "All unreads" shows confirmation text only, no channel selector — channels determined at generation time
- Match existing form patterns for dropdowns, inputs, validation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-enhanced-wizard*
*Context gathered: 2026-01-21*
