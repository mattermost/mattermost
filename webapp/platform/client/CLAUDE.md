# CLAUDE: `platform/client/` (`@mattermost/client`)

## Purpose
- Implements the Client4 HTTP layer and WebSocket client used by all Mattermost web apps and plugins.
- Source of truth for API endpoint definitions and low-level networking helpers.

## Structure
- `src/client4.ts` – REST endpoints, auth handling, retries.
- `src/websocket.ts` – WebSocket manager for real-time events.
- `src/helpers.ts` / `errors.ts` – shared logic for response parsing and error types.
- Tests (`*.test.ts`) cover each module; keep them in sync with new endpoints.

## Guidelines
- Follow `webapp/STYLE_GUIDE.md → Networking`.
- Each new server API must be added here first, including TypeScript types, documentation comments, and tests.
- Keep method signatures Promise-based and return `{response, headers, data}` objects to callers.
- Never reference React or browser globals—this package must run in Node (for SSR/tests) as well.

## Error Handling
- Throw `ClientError` (see `errors.ts`) with enough context for consumers to handle gracefully.
- Include `forceLogoutIfNecessary` logic upstream in calling actions; do not couple that here.
- Ensure WebSocket reconnection logic stays resilient; add regression tests under `websocket.test.ts`.

## References
- `src/client4.ts`, `src/websocket.ts`.
- Consumers: `channels/src/actions/*`, `platform/components` demos.



