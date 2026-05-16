# PR body examples

Copy these as starting points. Replace placeholders. Remove HTML comments if any appear in a template.

## Minimal (no ticket, no UI)

#### Summary
Fixed channel mention parsing when the display name contains Unicode spaces.

#### Release Note
```release-note
NONE
```

## With ticket and API release note

#### Summary
Added `GET /api/v4/users/:user_id/preferences` so clients can fetch preference bundles in one call.

**Test plan**
- Call the endpoint as a normal user and as a system admin
- Confirm 403 when requesting another user's preferences without permission

#### Ticket Link
Fixes https://github.com/mattermost/mattermost/issues/12345

#### Release Note
```release-note
Added GET /api/v4/users/:user_id/preferences.
```

## With screenshots

#### Summary
Updated the channel sidebar to show unread counts on collapsed categories.

#### Screenshots
| before | after |
|--------|-------|
| ![before](url) | ![after](url) |

#### Release Note
```release-note
Updated the channel sidebar to show unread counts on collapsed categories.
```
