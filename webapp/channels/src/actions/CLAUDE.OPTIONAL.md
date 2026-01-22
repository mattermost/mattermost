# CLAUDE: `actions/`

## Purpose
- Hosts Redux action creators (sync + thunk) for UI behaviors and server calls specific to the Channels webapp.
- Bridges components to `mattermost-redux` and `@mattermost/client`.

## Directory Structure

```
actions/
├── *.ts              # Domain-specific actions (channel_actions.ts, post_actions.ts, etc.)
└── views/            # UI-specific actions (modals, sidebars, etc.)
```

## Action Patterns

### Async Thunks

All async thunks must return `{data: ...}` on success or `{error: ...}` on failure.

```typescript
export function fetchSomething(id: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const data = await Client4.getSomething(id);
            dispatch({type: ActionTypes.RECEIVED_SOMETHING, data});
            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}
```

### Using bindClientFunc

For simple API calls, use `bindClientFunc` helper for standard error handling:

```typescript
export function fetchUser(userId: string): ActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.getUser,
        params: [userId],
        onSuccess: ActionTypes.RECEIVED_USER,
    });
}
```

## Conventions & Best Practices
- **Response Structure**: Async actions return `{data}` on success or `{error}` on failure (see `webapp/STYLE_GUIDE.md → Redux & Data Fetching`).
- **Actions Only**: Call `Client4` only inside actions; components should dispatch actions, never hit APIs directly.
- **Helpers**: Extract reusable async logic into helpers (`hooks.ts`, `apps.ts`) rather than duplicating inside multiple actions.
- **Entity Data**: When adding new entity data, first wire it through `channels/src/packages/mattermost-redux`, then consume selectors here.

## Error & Logging Requirements
- Catch errors to call `forceLogoutIfNecessary(error)` and dispatch `logError`.
- Use telemetry wrappers (`trackEvent`, `perf`) when adding analytics inside thunks.
- Always dispatch optimistic UI updates with corresponding failure rollback where user experience demands it.

## Batching Network Requests
- Use bulk API endpoints when available.
- Use `DelayedDataLoader` for batching multiple calls.
- Fetch data from parent components, not individual list items.

## views/ Subdirectory
UI state actions that don't involve server data (modals, sidebars, view state) dispatch to `state.views.*` reducers rather than `state.entities.*`.

## Testing
- Favor RTL-style async action tests with mocked store where possible (`channel_actions.test.ts`).
- Use `nock` or request-mocking utilities in `mattermost-redux` tests for complex flows.

## References
- `channel_actions.ts`, `global_actions.tsx` – canonical patterns for async thunks.
- `mattermost-redux/src/actions/*` – shared actions; import instead of duplicating server logic.
