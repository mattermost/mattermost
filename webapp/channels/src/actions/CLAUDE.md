# CLAUDE: `actions/`

## Purpose
- Hosts Redux action creators (sync + thunk) for UI behaviors and server calls specific to the Channels webapp.
- Bridges components to `mattermost-redux` and `@mattermost/client`.

## Conventions
- Async actions return `{data}` on success or `{error}` on failure (see `webapp/STYLE_GUIDE.md → Redux & Data Fetching`).
- Call `Client4` only inside actions; components should dispatch actions, never hit APIs directly.
- Wrap API calls with `bindClientFunc` when available to standardize error handling, force logout, and telemetry.
- Batch related network requests to reduce API chatter; prefer server bulk endpoints or `DelayedDataLoader`.

## Structure
- Keep one file per domain (`channel_actions.ts`, `post_actions.ts`, etc.). Co-locate tests as `*.test.ts`.
- Extract reusable async logic into helpers (`hooks.ts`, `apps.ts`) rather than duplicating inside multiple actions.
- When adding new entity data, first wire it through `channels/src/packages/mattermost-redux`, then consume selectors here.

## Error & Logging Requirements
- Catch errors to call `forceLogoutIfNecessary(error)` and dispatch `logError`.
- Use telemetry wrappers (`trackEvent`, `perf`) when adding analytics inside thunks.
- Always dispatch optimistic UI updates with corresponding failure rollback where user experience demands it.

## Testing
- Favor RTL-style async action tests with mocked store where possible (`channel_actions.test.ts`).
- Use `nock` or request-mocking utilities in `mattermost-redux` tests for complex flows.

## References
- `channel_actions.ts`, `global_actions.tsx` – canonical patterns for async thunks.
- `mattermost-redux/src/actions/*` – shared actions; import instead of duplicating server logic.
- `webapp/STYLE_GUIDE.md → Networking`, `Redux & Data Fetching`.

