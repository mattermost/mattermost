# Summary: 05-06 Edit Wiring

## Metadata
- **Phase:** 05-enhanced-wizard
- **Plan:** 06
- **Status:** Complete
- **Duration:** ~45 min (including extensive UI polish during human verification)

## What Was Built

Wired up the edit functionality so clicking "Edit" on a scheduled recap opens the modal pre-filled with existing data. During human verification, extensive UI polish was applied based on user feedback.

## Deliverables

### Core Edit Wiring
- `webapp/channels/src/components/recaps/recaps.tsx` — `handleEditScheduledRecap` passes scheduled recap to modal via `dialogProps.editScheduledRecap`

### Bug Fixes (discovered during verification)
- `webapp/platform/client/src/client4.ts` — Fixed JSON.stringify for scheduled recap API calls
- `webapp/channels/src/components/create_recap_modal/schedule_configuration.tsx` — Aligned time period values with server model

### UI Polish (based on human feedback)
- Removed duplicate border on custom instructions textarea
- Fixed modal height jumping when selecting days
- Removed border/background from next-run-preview (plain text style)
- Abbreviated timezone display (EST instead of full name)
- Added section titles per Figma design
- Fixed spacing between section titles and dropdowns
- Used standard Toggle component without text labels
- Fixed toggle active color to use button-bg

### Navigation Fixes
- Fixed tab navigation after creating scheduled recap (using `getCurrentRelativeTeamUrl` selector)
- Implemented bidirectional URL sync for tab state
- Sorted scheduled recaps list by newest first

## Commits

| Hash | Description |
|------|-------------|
| ccfa6e44b8 | feat(05-06): update handleEditScheduledRecap to pass scheduled recap to modal |
| 7cf45ef6ee | fix(05-06): JSON.stringify body in scheduled recap API calls |
| 4cf819851a | fix(05-06): align time period values with server model |
| 89597916e9 | fix(05-06): remove duplicate border on custom instructions textarea |
| df1b6ce7e3 | fix(05-06): reserve space for next run preview to prevent modal height jump |
| 0198c6e73a | fix(05-06): remove border/background from next-run-preview |
| 11164e47e5 | fix(05-06): use abbreviated timezone in next recap preview |
| f597a49f8b | fix(05-06): prevent modal height jump when next run preview appears |
| 00d19f5e42 | fix(05-06): add section titles and fix spacing in schedule configuration |
| 1f9835b2b8 | fix(05-06): remove duplicate title and fix subtitle-dropdown spacing |
| fbb840c3c3 | fix(05-06): use standard Toggle without text labels for active/paused state |
| 290edf1cbd | fix(05-06): toggle color and tab navigation after creating scheduled recap |
| 3d56833b13 | fix(05-06): sync tab state with URL bidirectionally |
| 0ed3899e5c | fix(05-06): fix navigation to scheduled tab after creating scheduled recap |
| b094a34dd7 | fix(05-06): sort scheduled recaps by newest first |

## Verification

Human verified:
- [x] Run once flow creates immediate recap
- [x] Scheduled flow creates scheduled recap in Scheduled tab
- [x] Edit opens modal with pre-filled values
- [x] Save changes updates the scheduled recap
- [x] Navigation to scheduled tab works after creation
- [x] Toggle styling matches design system
- [x] Section titles and spacing match Figma
- [x] Scheduled recaps sorted newest first

## Decisions

| Decision | Rationale |
|----------|-----------|
| Use `getCurrentRelativeTeamUrl` for navigation | Modal rendered at root level, `useRouteMatch` returns wrong URL |
| Bidirectional URL sync for tabs | Query params weren't being read/written consistently |
| `history.replace` for tab changes | Avoid polluting browser history when switching tabs |
| `btn-toggle-primary` class for toggle | Uses `var(--button-bg)` for correct blue color |
