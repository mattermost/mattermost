# CLAUDE.md

Guidance for Claude Code when working inside `webapp/`.

## Project Overview
- Mattermost Channels web client built with React + Redux inside an npm workspace monorepo.
- Primary workspace: `channels/` (UI, Redux, routing). Shared packages: `platform/*`.
- Scripts under `webapp/scripts/` power dev server, builds, and localization flows.
- Read `webapp/STYLE_GUIDE.md` for canonical coding standards; nested `CLAUDE.md` files cover directory-specific rules.

## Core Commands
| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Dev server (prod build watch) | `make run` |
| Dev server (webpack-dev-server) | `make dev` or `npm run dev-server --workspace=channels` |
| Build all workspaces | `make dist` or `npm run build` |
| Build Channels only | `npm run build --workspace=channels` |
| Tests | `make test` or `npm run test --workspace=channels` (use `test:watch`, `test:updatesnapshot` as needed) |
| Lint / Style | `make check-style`, `make fix-style`, `npm run check --workspace=channels`, `npm run fix --workspace=channels` |
| Type check | `make check-types` |
| Clean artifacts | `make clean` or `npm run clean --workspaces --if-present` |

## Top-Level Directory Map
- `channels/` – Channels workspace. See `channels/CLAUDE.md`.
  - `src/` – App source with further scoped guides (components, actions, selectors, reducers, store, sass, i18n, tests, utils, types, plugins, packages/mattermost-redux).
- `platform/` – Shared packages (`client`, `components`, `types`, `eslint-plugin`). See `platform/CLAUDE.md` plus sub-guides.
- `scripts/` – Build/dev automation. See `scripts/CLAUDE.md`.
- `STYLE_GUIDE.md` – Authoritative style + accessibility + testing reference.
- `README.md`, `config.mk`, `Makefile` – onboarding, env config, and command wiring.

## Cross-Cutting Standards
- Prefer functional React components with hooks; memoize expensive logic.
- Client4/WebSocket access happens via Redux actions only—never directly from components.
- All UI strings must be translatable via React Intl. Use `FormattedMessage` unless a raw string is required.
- Styling uses SCSS + CSS variables with BEM naming; avoid `!important` unless migrating legacy code.
- RTL + `userEvent` for tests; no snapshots. Use helpers under `channels/src/tests/`.
- Follow accessibility guidance in `STYLE_GUIDE.md` (semantic elements, keyboard support, focus management).

## Common Gotchas
- Platform packages rebuild automatically on `npm install`; re-run if types appear stale.
- Always add dependencies with `npm add <pkg> --workspace=channels` (or the relevant workspace).
- Keep webpack aliases and `tsconfig` path mappings in sync when introducing new paths.
- Redux state split: `state.entities.*` (server data via mattermost-redux) vs `state.views.*` (UI/persisted). Store new server entities in mattermost-redux first.
- `Client4` methods return `{response, headers, data}` – unwrap accordingly in actions.
- Tests requiring Redux/Router/Intl context must render via `renderWithContext` from `channels/src/tests/react_testing_utils.tsx`.

## Nested CLAUDE Files
- Channels workspace: `channels/CLAUDE.md`, `channels/src/CLAUDE.md`.
- Channels source subfolders: `components/`, `actions/`, `selectors/`, `reducers/`, `store/`, `sass/`, `i18n/`, `tests/`, `utils/`, `types/`, `plugins/`, `packages/mattermost-redux/`.
- Platform packages: `platform/CLAUDE.md`, plus `platform/client/`, `platform/components/`, `platform/types/`.
- Tooling: `scripts/CLAUDE.md`.

Use these nested guides for focused, actionable instructions when working within each directory.
