# CLAUDE: `store/`

## Purpose
- Configures the Redux store, middleware stack, and persistence for the Channels webapp.
- Entry point for wiring reducers, enhancers, telemetry, and devtools.

## Key Files
- `index.ts` – store factory, middleware registration, persistence config.
- `index.test.ts` – regression tests for middleware order and persistence.

## Conventions
- Middleware order matters: diagnostics/logging first, async (thunk) middle, routing last.
- Persistence uses `redux-persist` + `localForage`. Keep whitelist/blacklist in sync with reducer ownership.
- Avoid adding new global listeners in the store; prefer feature-specific middleware or hooks.
- When adding middleware, document why a global solution is needed versus feature-level listeners.

## Cross-Workspace Rules
- Shared entities live in `mattermost-redux`. Only include webapp-specific reducers here.
- Do not instantiate `Client4` or other singletons in the store; inject via actions/middleware.
- Keep store typing up to date via `channels/src/types/store/index.ts` to ensure selectors have accurate types.

## References
- `webapp/STYLE_GUIDE.md → Redux & Data Fetching` (state organization, persistence guidance).
- Example middleware: `websocket_actions.jsx` wiring, `plugins` middleware from `channels/src/plugins`.



