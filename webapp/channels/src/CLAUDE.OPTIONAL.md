# CLAUDE: `channels/src/`

## Purpose
- React + Redux source for the Channels app. Everything rendered in the browser lives here.
- Split by concern: UI (`components`, `sass`), data (`actions`, `reducers`, `selectors`, `store`), utilities, and feature-specific packages.

## Directory Map
- `components/` – feature folders for UI (see `components/CLAUDE.md`).
- `actions/`, `reducers/`, `selectors/`, `store/` – Redux stack (each has its own CLAUDE).
- `sass/` – theme variables and global styles.
- `i18n/` – locale JSON plus helpers.
- `utils/`, `types/` – shared helpers + local type definitions.
- `packages/mattermost-redux/` – embedded redux package mirroring the standalone repo.

## Layering Rules
- Components never call `Client4` directly; async work flows through `actions` → `mattermost-redux` → API packages.
- Shared state comes from `mattermost-redux/state.entities.*`; UI/persisted state belongs in `state.views.*`.
- Prefer hooks (`useSelector`, `useDispatch`, custom hooks) over legacy HOCs.
- Keep cross-layer imports stable: `components` may import `selectors`, `utils`, `types`, but not `reducers` or `store`.

## State Management Primer
- Redux store configured in `store/index.ts`; persistence handled via redux-persist + localForage.
- Selector factories (`makeGet...`) should be memoized per component instance.
- Use `mattermost-redux` for server-backed data; add new entity fields there first, then expose selectors into this workspace.

## How to Navigate
- Start from route entry (`root.tsx` and `root.html`) to understand bootstrapping and async chunk loading.
- `module_registry.ts` registers dynamically loaded views; ensure new routes/components are wrapped with `makeAsyncComponent` where appropriate.
- Before adding a new folder, check for an existing feature area under `components` or `utils`.

## References
- `webapp/STYLE_GUIDE.md → React Component Structure`, `Redux & Data Fetching`.
- Example: `root.tsx` (bootstrapping), `module_registry.ts` (async component wiring).



