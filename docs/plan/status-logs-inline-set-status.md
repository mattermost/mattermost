# Plan: Add Inline Status Change Controls to Status Logs Dashboard

## Context
Users who manually set themselves to Online (or any other status) need to be manageable from the Status Logs dashboard. The admin wants to be able to change any user's status directly from each log entry row, without navigating to a separate admin page.

## Approach
Add an inline dropdown button on each log card's header-right section (next to the existing copy button). When clicked, it shows a small dropdown with all 4 status options (Online, Away, DND, Offline). Selecting one calls the existing `PUT /api/v4/users/{user_id}/status` endpoint via `Client4.updateStatus()`.

**No server-side changes needed** — the API already exists and supports admin setting other users' statuses.

## Files to Modify

### 1. `webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.tsx`

**Changes:**
- Add state for tracking which log entry's dropdown is open: `const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)`
- Add state for tracking in-progress status updates: `const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)`
- Add a `setUserStatus(userId: string, status: string)` async handler that:
  - Calls `Client4.updateStatus({user_id: userId, status: status, manual: true})`
  - Closes the dropdown
  - Shows brief success/error feedback
- Add inline dropdown button in each log card's `header-right` div (after the copy button, before the time span at ~line 1607)
- Add click-outside handler to close the dropdown
- The dropdown shows 4 status options with colored status dots matching existing `getStatusColor()` helper

**UI structure per log card (new element):**
```tsx
<div className='StatusLogDashboard__log-card__status-dropdown'>
  <button onClick={toggle dropdown}>
    <IconEdit/> {/* or a status icon */}
  </button>
  {dropdownOpen && (
    <div className='StatusLogDashboard__log-card__status-menu'>
      <button onClick={set online}>● Online</button>
      <button onClick={set away}>● Away</button>
      <button onClick={set dnd}>● DND</button>
      <button onClick={set offline}>● Offline</button>
    </div>
  )}
</div>
```

### 2. `webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.scss`

**Changes:**
- Style the dropdown trigger button (match existing `__action-btn` pattern)
- Style the dropdown menu (absolute positioned, z-indexed above cards)
- Style individual status options with colored dots
- Add hover/active states
- Handle the loading/disabled state when a status change is in progress

## Existing Code to Reuse
- `Client4.updateStatus(status)` at `webapp/platform/client/src/client4.ts:1145` — already supports setting any user's status
- `getStatusColor(status)` helper already in the dashboard component — maps status to CSS color classes
- Existing `__action-btn` CSS class for button styling
- Existing SVG icon pattern used throughout the component

## Verification
1. Push to master and run `gh workflow run test.yml --ref master`
2. Manual test: Open Status Logs dashboard, click the new dropdown on any log entry, select a different status, verify the status changes in real-time (new log entry should appear)
