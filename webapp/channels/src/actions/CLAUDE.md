# actions/

Redux action creators for the web app. Contains both sync actions and async thunks.

## Directory Structure

```
actions/
├── *.ts              # Domain-specific actions (channel_actions.ts, post_actions.ts, etc.)
└── views/            # UI-specific actions (modals, sidebars, etc.)
```

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

## Batching Network Requests

Batch requests when possible:
- Use bulk API endpoints when available
- Use `DelayedDataLoader` for batching multiple calls
- Fetch data from parent components, not individual list items

## views/ Subdirectory

UI state actions that don't involve server data:
- Modal open/close actions
- Sidebar toggle actions  
- View state updates

These dispatch to `state.views.*` reducers rather than `state.entities.*`.

## Reference Implementations

- `channel_actions.ts`: Channel CRUD operations with error handling
- `post_actions.ts`: Post operations with optimistic updates
- `views/modals.ts`: Modal state management
