# @mattermost/client

REST and WebSocket client for the Mattermost API.

## Files

```
src/
├── client4.ts      # Main HTTP client class
├── websocket.ts    # WebSocket client for real-time events
├── errors.ts       # Error types and handling
├── helpers.ts      # Client helper functions
└── index.ts        # Package exports
```

## Client4

Singleton HTTP client for all Mattermost API requests.

### Response Structure

All `Client4` methods return `Promise<ClientResponse<T>>`:

```typescript
interface ClientResponse<T> {
    response: Response;  // Fetch Response object
    headers: Headers;    // Response headers
    data: T;            // Parsed response data
}
```

### Usage Rules

1. **Actions Only**: `Client4` should only be called from Redux actions, never directly in components
2. **Singleton**: Import and use the singleton instance
3. **Error Handling**: Always handle errors appropriately

```typescript
import {Client4} from '@mattermost/client';

// In a Redux action
export function getUser(userId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const {data} = await Client4.getUser(userId);
            dispatch({type: RECEIVED_USER, data});
            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}
```

## Adding New Endpoints

Add new API methods to `client4.ts`:

```typescript
// In Client4 class
getSomething = (id: string) => {
    return this.doFetch<SomethingType>(
        `${this.getSomethingRoute(id)}`,
        {method: 'get'},
    );
};

createSomething = (data: CreateSomethingRequest) => {
    return this.doFetch<SomethingType>(
        `${this.getSomethingsRoute()}`,
        {method: 'post', body: JSON.stringify(data)},
    );
};
```

## WebSocket Client

`websocket.ts` provides real-time event handling:

- Connection management
- Automatic reconnection
- Event dispatching

The WebSocket client is typically accessed through the web app's `WebSocketClient` wrapper, not directly.

## Error Types

`errors.ts` defines:
- `ClientError`: Base client error class
- Error response parsing utilities

## Testing

```bash
npm run test --workspace=@mattermost/client
```

Tests use Jest and mock fetch responses.



