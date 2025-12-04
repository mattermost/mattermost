# Actions CLAUDE.md

## API & Networking Patterns
- **Client4 Singleton**: All HTTP requests MUST use the `Client4` instance from `@mattermost/client`.
- **Location**: `Client4` calls should ONLY happen inside Redux actions (Thunks). Never directly in components.
- **Adding Endpoints**: Add new API methods to `platform/client` package first.

## Thunk Patterns
- **Async Thunks**: Use for all API interactions.
- **Return Values**: 
  - Success: `{ data: result }`
  - Failure: `{ error: error }`
- **Batching**: Batch network requests where possible (`DelayedDataLoader` or bulk endpoints).

## Error Handling
- **bindClientFunc**: Use `bindClientFunc` helper when possible to wrap Client4 calls.
- **Manual Handling**:
  ```typescript
  try {
      const data = await Client4.someCall();
      return {data};
  } catch (error) {
      forceLogoutIfNecessary(error, dispatch);
      dispatch(logError(error));
      return {error};
  }
  ```



