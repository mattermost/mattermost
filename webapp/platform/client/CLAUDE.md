# Client Platform CLAUDE.md

## Overview
This package (`@mattermost/client`) contains the JavaScript/TypeScript client for interacting with the Mattermost Server REST API and WebSocket.

## Patterns
- **Singleton**: The application uses a singleton instance `Client4` exported from this package.
- **Usage**: The singleton should primarily be used within Redux Actions in the `channels` workspace.

## Adding Endpoints
When adding new API endpoints:
1. Add the method to the `Client4` class.
2. Type the response using `Promise<ClientResponse<T>>`.
3. The `ClientResponse<T>` type includes `{ response, headers, data: T }`.

## Error Handling
- Methods should generally throw errors that can be caught by the caller (Redux actions).
- Use established patterns for constructing requests (e.g., `this.doFetch`, `this.doPost`).



