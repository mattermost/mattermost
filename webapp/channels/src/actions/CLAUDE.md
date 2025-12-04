# CLAUDE: `actions/`

Redux action creators for the web app. Contains both sync actions and async thunks.

## Purpose

- Hosts Redux action creators (sync + thunk) for UI behaviors and server calls specific to the Channels webapp
- Bridges components to `mattermost-redux` and `@mattermost/client`

## Directory Structure

```
actions/
├── *.ts              # Domain-specific actions (channel_actions.ts, post_actions.ts, etc.)
└── views/            # UI-specific actions (modals, sidebars, etc.)
```

## Conventions

- Async actions return `{data}` on success or `{error}` on failure (see `webapp/STYLE_GUIDE.md → Redux & Data Fetching`)
- Call `Client4` only inside actions; components should dispatch actions, never hit APIs directly
- Wrap API calls with `bindClientFunc` when available to standardize error handling, force logout, and telemetry
- Batch related network requests to reduce API chatter; prefer server bulk endpoints or `DelayedDataLoader`

## Action Patterns

### Async Thunks

All async thunks must return `{data: ...}` on success or `{error: ...}` on failure:

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

## Client4 Rules

- **Actions Only**: `Client4` should only be called from Redux actions, never directly in components
- **Error Handling**: Always use `bindClientFunc` or wrap in try/catch with `forceLogoutIfNecessary` + `logError`
- **Response Structure**: `Client4` methods return `Promise<ClientResponse<T>>` with `{response, headers, data}`

## Structure Guidelines

- Keep one file per domain (`channel_actions.ts`, `post_actions.ts`, etc.). Co-locate tests as `*.test.ts`
- Extract reusable async logic into helpers rather than duplicating inside multiple actions
- When adding new entity data, first wire it through `channels/src/packages/mattermost-redux`, then consume selectors here

## Error & Logging Requirements

- Catch errors to call `forceLogoutIfNecessary(error)` and dispatch `logError`
- Use telemetry wrappers (`trackEvent`, `perf`) when adding analytics inside thunks
- Always dispatch optimistic UI updates with corresponding failure rollback where user experience demands it

## views/ Subdirectory

UI state actions that don't involve server data:
- Modal open/close actions
- Sidebar toggle actions  
- View state updates

These dispatch to `state.views.*` reducers rather than `state.entities.*`.

## Reference Implementations

- `channel_actions.ts`: Channel CRUD operations with error handling
- `post_actions.ts`: Post operations with optimistic updates
- `global_actions.tsx`: Canonical patterns for async thunks
- `views/modals.ts`: Modal state management
