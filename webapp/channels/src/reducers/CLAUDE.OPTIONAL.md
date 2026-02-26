# CLAUDE: `reducers/`

## Purpose
- Define how Redux state changes in response to actions for the Channels webapp.
- Split between `state.entities.*` (server data via mattermost-redux) and `state.views.*` (webapp UI + persisted state).

## Structure
- Root reducer composition lives in `reducers/index.ts`.
- Domain reducers belong under `reducers/views/*` for UI state or under `packages/mattermost-redux` for server entities.
- Keep files focused: one reducer per domain with clear initial state exports and typed actions.

## Conventions
- Treat state as immutable – use spread, `combineReducers`, or helper functions rather than mutating.
- Persistable slices must define their keys in `store/index.ts` persistence config.
- Document any side-effects (e.g., clearing caches when team changes) with inline comments.

## Testing & Validation
- Each reducer should have a companion `*.test.ts` covering happy paths, reset cases, and regression bugs.
- When updating state shape, update TypeScript definitions under `channels/src/types/store/`.
- Keep reducers serialization-safe; avoid storing functions, class instances, or DOM references.

## References
- `reducers/views/channel_sidebar.ts` – example of complex UI reducer.
- `reducers/index.ts` – wiring pattern for new reducers.
- `webapp/STYLE_GUIDE.md → Organizing Redux State`, `Standards Needing Refinement → Handler Placement`.



