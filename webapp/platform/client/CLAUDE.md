# CLAUDE: `platform/client/`

## Context
- Package: `@mattermost/client`
- Role: Singleton HTTP/WS client. Source of truth for API.

## Rules
- **Usage**: Redux Actions ONLY. No components.
- **Returns**: `Promise<ClientResponse<T>>` where `ClientResponse = { response, headers, data: T }`.
- **Errors**: Throw `ClientError`. Do not swallow.

## Template: Adding Endpoint
Update `client4.ts`:

```typescript
getThing = (id: string) => {
    return this.doFetch<ThingType>(
        `${this.getThingRoute(id)}`,
        {method: 'get'}
    );
};

createThing = (data: CreateRequest) => {
    return this.doFetch<ThingType>(
        `${this.getThingsRoute()}`,
        {method: 'post', body: JSON.stringify(data)}
    );
};
```

## WebSocket
- **File**: `src/websocket.ts`.
- **Role**: Connection management, Reconnect logic, Event dispatch.
