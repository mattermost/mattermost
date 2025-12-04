# CLAUDE.md

Guidance for Claude Code when working inside `webapp/`.

## Project Overview

Mattermost Channels web client built with React + Redux inside an npm workspace monorepo. The main application code is in the `channels` package and shared platform code in `platform/*` packages.

For comprehensive style and convention guidance, see [STYLE_GUIDE.md](./STYLE_GUIDE.md).

## Directory Structure

```
webapp/
├── channels/           # Main Mattermost web app (UI, Redux, application code)
├── platform/           # Shared packages
│   ├── client/         # @mattermost/client - REST and WebSocket client
│   ├── components/     # @mattermost/components - Shared React components
│   ├── types/          # @mattermost/types - TypeScript type definitions
│   └── eslint-plugin/  # @mattermost/eslint-plugin - Custom ESLint rules
├── scripts/            # Build orchestration (build.mjs, run.mjs, dev-server.mjs)
└── patches/            # Dependency patches
```

## Core Commands

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Dev server (prod build watch) | `make run` |
| Dev server (webpack-dev-server) | `make dev` or `npm run dev-server --workspace=channels` |
| Build all workspaces | `make dist` or `npm run build` |
| Build Channels only | `npm run build --workspace=channels` |
| Tests | `make test` or `npm run test --workspace=channels` |
| Lint / Style | `make check-style`, `make fix-style`, `npm run check --workspace=channels` |
| Type check | `make check-types` |
| Clean artifacts | `make clean` or `npm run clean --workspaces --if-present` |

## Workspace Architecture

This repository uses npm workspaces:

- **channels** (`channels/`): Main web app with UI components, Redux logic, and application code
- **@mattermost/types** (`platform/types/`): TypeScript type definitions
- **@mattermost/client** (`platform/client/`): REST and WebSocket client for the API
- **@mattermost/components** (`platform/components/`): Shared React components
- **@mattermost/eslint-plugin** (`platform/eslint-plugin/`): Custom ESLint rules
- **mattermost-redux** (`channels/src/packages/mattermost-redux/`): Redux state management (legacy internal package)

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
- **Redux 5.0**: State management with thunk middleware
- **React Router 5.3**: Client-side routing
- **React Intl**: Internationalization
- **Floating UI**: Tooltips and popovers (prefer `WithTooltip` component)
- **@mattermost/compass-icons**: Icon library (prefer over font-awesome)
- **Monaco Editor**: Code editor integration
- **Styled Components**: Limited use (for MUI and some legacy components)

## Module Federation

The app uses webpack module federation for plugin architecture, allowing dynamic loading of remote modules at runtime.

## TypeScript

- **Strict Mode**: TypeScript strict mode enabled with `strictNullChecks`
- **Path Aliases**: Configured for `@mattermost/*` packages and `mattermost-redux/*`
- **Composite Projects**: Uses TypeScript project references for workspace packages
- **No Any**: Avoid `any` types; legacy code may have them but new code should be typed

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
- Redux state split: `state.entities.*` (server data via mattermost-redux) vs `state.views.*` (UI/persisted).
- `Client4` methods return `{response, headers, data}` – unwrap accordingly in actions.
- Tests requiring Redux/Router/Intl context must render via `renderWithContext` from `channels/src/tests/react_testing_utils.tsx`.
- Use absolute paths/aliases for imports whenever possible.

## Nested CLAUDE Files

- Channels workspace: `channels/CLAUDE.md`, `channels/src/CLAUDE.md`
- Channels source subfolders: `components/`, `actions/`, `selectors/`, `reducers/`, `store/`, `sass/`, `i18n/`, `tests/`, `utils/`, `types/`, `plugins/`, `packages/mattermost-redux/`
- Platform packages: `platform/CLAUDE.md`, plus `platform/client/`, `platform/components/`, `platform/types/`
- Tooling: `scripts/CLAUDE.md`

Use these nested guides for focused, actionable instructions when working within each directory.
