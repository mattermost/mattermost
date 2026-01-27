# Phase 09 UAT: User-Facing UX

## Context
Validating that users receive clear feedback about limits, including usage tracking, warnings, and blocking when limits are exceeded.

## Tests

### Usage Visibility
- [x] User sees "X of Y recaps used today" badge in the Recaps UI
- [x] Clicking the badge shows a popover with daily reset time (in user's timezone)
- [x] Badge turns orange when usage reaches 80% (e.g., 4/5)
- [x] Badge turns red/error style when limit is reached (5/5)

### Enforcement Feedback
- [x] "Add a recap" button is disabled/blocked when daily limit is reached
- [x] Attempting to run a recap while in cooldown shows a countdown timer
- [x] Error messages explicitly state "Your organization's policy limits..." when blocked

### Real-time Updates
- [x] Usage count updates immediately after running a new recap
