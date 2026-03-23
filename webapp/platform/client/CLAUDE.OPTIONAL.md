# CLAUDE: `platform/client/` (`@mattermost/client`)

## Purpose
- Implements the Client4 HTTP layer and WebSocket client used by all Mattermost web apps and plugins.
- Source of truth for API endpoint definitions and low-level networking helpers.

## Structure
- `src/client4.ts` – REST endpoints, auth handling, retries.
- `src/websocket.ts` – WebSocket manager for real-time events.
- `src/helpers.ts` / `errors.ts` – shared logic for response parsing and error types.

## Client4 Usage
Singleton HTTP client for all Mattermost API requests. Methods return `Promise<ClientResponse<T>>`:

```typescript
interface ClientResponse<T> {
    response: Response;  // Fetch Response object
    headers: Headers;    // Response headers
    data: T;            // Parsed response data
}
```

### Usage Rules
1. **Actions Only**: `Client4` should only be called from Redux actions, never directly in components.
2. **Error Handling**: Always handle errors appropriately.

## Adding New Endpoints
Add new API methods to `client4.ts`. Keep signatures Promise-based.

```typescript
getSomething = (id: string) => {
    return this.doFetch<SomethingType>(
        `${this.getSomethingRoute(id)}`,
        {method: 'get'},
    );
};
```

## Error Handling
- Throw `ClientError` (see `errors.ts`) with enough context.
- Include `forceLogoutIfNecessary` logic upstream in calling actions; do not couple that here.

## WebSocket Client
`websocket.ts` provides real-time event handling, connection management, and automatic reconnection. Accessed via `WebSocketClient` wrapper in web app.

## Guidelines
- Follow `webapp/STYLE_GUIDE.md → Networking`.
- Each new server API must be added here first, including TypeScript types and tests.
- Never reference React or browser globals—this package must run in Node.
