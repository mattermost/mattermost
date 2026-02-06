# CLAUDE.md

Guidance for Claude Code when working inside `webapp/`.

## Project Overview

This is the Mattermost web app codebase, a React-based frontend application for the Mattermost collaboration platform. The repository is structured as an npm workspace monorepo with multiple packages, with the main application code in the `channels` package and shared platform code in `platform/*` packages.

- **Primary workspace**: `channels/` (UI, Redux, routing).
- **Shared packages**: `platform/*`.
- **Scripts**: `webapp/scripts/` power dev server, builds, and localization flows.
- **Coding Standards**: Read `webapp/STYLE_GUIDE.md` for canonical standards; nested `CLAUDE.md` files cover directory-specific rules.

## Core Commands

| Task | Command |
| --- | --- |
| Install deps | `npm install` (includes postinstall build of platform packages) |
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

## Workspace Architecture

This repository uses npm workspaces:

- **channels** (`channels/`): Main Mattermost web app containing all UI components, Redux logic, and application code
- **@mattermost/types** (`platform/types/`): TypeScript type definitions
- **@mattermost/client** (`platform/client/`): REST and WebSocket client for the Mattermost API
- **@mattermost/components** (`platform/components/`): Shared React components
- **@mattermost/eslint-plugin** (`platform/eslint-plugin/`): Custom ESLint rules

### Importing Packages

Always import packages using their full name, never relative paths:
```typescript
// Correct
import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

// Incorrect
import Client4 from '../platform/client/src/client4.ts';
```

## Key Dependencies

- **React 18.2**: Main UI framework
- **Redux 5.0**: State management
- **React Router 5.3**: Client-side routing
- **React Intl**: Internationalization
- **Floating UI**: Tooltips and popovers (prefer `WithTooltip` component)
- **@mattermost/compass-icons**: Icon library (prefer over font-awesome)
- **Monaco Editor**: Code editor integration
- **Styled Components**: Limited use (for MUI and some legacy components)

## Important Configuration Files

- `channels/webpack.config.js`: Webpack configuration with module federation
- `channels/jest.config.js`: Jest test configuration
- `channels/tsconfig.json`: TypeScript configuration with workspace references
- `channels/.eslintrc.json`: ESLint configuration

## Cross-Cutting Standards & Common Gotchas

- **Functional Components**: Prefer functional React components with hooks; memoize expensive logic.
- **Data Access**: Client4/WebSocket access happens via Redux actions only—never directly from components.
- **Internationalization**: All UI strings must be translatable via React Intl. Use `FormattedMessage` unless a raw string is required.
- **Styling**: Uses SCSS + CSS variables with BEM naming; avoid `!important` unless migrating legacy code.
- **Testing**: RTL + `userEvent` for tests; no snapshots. Use helpers under `channels/src/tests/`.
- **Accessibility**: Follow guidance in `STYLE_GUIDE.md` (semantic elements, keyboard support, focus management).
- **Platform Packages**: Rebuild automatically on `npm install`; re-run if types appear stale.
- **Adding Dependencies**: Always add dependencies with `npm add <pkg> --workspace=channels` (or the relevant workspace).
- **Redux State Split**: `state.entities.*` (server data via mattermost-redux) vs `state.views.*` (UI/persisted). Store new server entities in mattermost-redux first.
- **Client4 Returns**: Methods return `{response, headers, data}` – unwrap accordingly in actions.

## Nested CLAUDE Files

- Channels workspace: `channels/CLAUDE.md`, `channels/src/CLAUDE.md`.
- Channels source subfolders: `components/`, `actions/`, `selectors/`, `reducers/`, `store/`, `sass/`, `i18n/`, `tests/`, `utils/`, `types/`, `plugins/`, `packages/mattermost-redux/`.
- Platform packages: `platform/CLAUDE.md`, plus `platform/client/`, `platform/components/`, `platform/types/`.
- Tooling: `scripts/CLAUDE.md`.

Use these nested guides for focused, actionable instructions when working within each directory.
