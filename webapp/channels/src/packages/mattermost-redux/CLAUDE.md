# CLAUDE: `packages/mattermost-redux/`

## Purpose
- Embedded copy of the `mattermost-redux` package for local development.
- Owns canonical Redux entities, actions, selectors, and request helpers shared across products.

## When to Edit
- Add/modify server-sourced entities (`state.entities.*`), request status tracking, or shared selectors.
- Introduce new Client4 endpoints (paired with `platform/client`) or action helpers.
- Avoid webapp-specific logic; keep files reusable across products (Channels, Boards, Playbooks).

## Structure
- `src/actions/*` – async logic calling `Client4` via `bindClientFunc`.
- `src/reducers/entities/*` – normalized entity slices (users, channels, posts, etc.).
- `src/selectors/entities/*` – memoized selectors; prefer composing rather than re-deriving state downstream.
- `src/store/` – helper for configuring redux store in standalone builds/tests.
- `src/utils/*` – shared utilities (arrays, posts, notify props).

## Conventions
- All async actions return `{data}` or `{error}` objects; keep request statuses updated via `RequestTypes`.
- When adding endpoints, update `client/index.ts`, Types, and relevant action/reducer files.
- Maintain TypeScript strictness; add tests under `__tests__` where behaviors are complex.
- Coordinate API contracts with server changes; document required server versions in commit/PR descriptions.

## References
- `src/actions/channels.ts`, `src/selectors/entities/channels.ts`, `src/utils/post_list.ts` – representative files.
- `webapp/STYLE_GUIDE.md → Redux & Data Fetching`, `Networking`.



