# CLAUDE: `actions/`

## Rules
- **Scope**: Redux action creators (Sync + Thunk).
- **Client Usage**: Call `Client4` ONLY here. Never in components.
- **Return Types**: Async actions MUST return `{data}` or `{error}`.
- **Error Handling**:
  - Wrap calls in `try/catch` or `bindClientFunc`.
  - On error: Call `forceLogoutIfNecessary(error)` AND dispatch `logError`.

## Patterns

### Async Thunk
```typescript
export function fetchItem(id: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const {data} = await Client4.getItem(id); // Client4 returns {data, response, headers}
            dispatch({type: RECEIVED_ITEM, data});
            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}
```

### Helper: bindClientFunc
Use for simple fetches to standardize errors.
```typescript
return bindClientFunc({
    clientFunc: Client4.getUser,
    params: [userId],
    onSuccess: ActionTypes.RECEIVED_USER,
});
```

## Best Practices
- **Batching**: Use `DelayedDataLoader` or bulk endpoints.
- **Optimistic UI**: Dispatch success state immediately; rollback on failure if needed.
