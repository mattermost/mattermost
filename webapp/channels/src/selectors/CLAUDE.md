# CLAUDE: `selectors/`

## Purpose
- Derive memoized data from Redux state for use in components, hooks, and actions.
- Keep state computations centralized to avoid duplication and unnecessary renders.

## Patterns
- Use `reselect`'s `createSelector` for any selector returning new objects/arrays. No bare functions that allocate per call.
- For selectors requiring parameters, export a factory (`makeGetVisiblePosts`) that builds and memoizes its own selector.
- Memoize selector instances inside components with `useMemo(() => makeGet..., [])`.
- Split selectors by domain: generic ones at the root, UI-specific ones under `views/`.

## Naming & Structure
- `selectors/posts.ts` – canonical example for feed computations.
- `selectors/views/channel_sidebar.ts` – pattern for per-view selectors.
- Keep test files next to implementation (`*.test.ts`) to document memoization expectations.

## Usage Rules
- Avoid cross-imports from reducers or store. Selectors should depend only on state shape and other selectors.
- When tapping `mattermost-redux` selectors, re-export or compose them locally for clarity.
- Document any selector that relies on specific state initialization (e.g., persisted drafts) in code comments.

## References
- `webapp/STYLE_GUIDE.md → Redux & Data Fetching → Selectors`.
- Example factories: `views/threads.ts`, `posts.ts`.



