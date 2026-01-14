# CLAUDE: `webapp/channels/`

## Purpose
- Main Mattermost web client workspace; almost every UI or Redux change flows through this package.
- Runs as an npm workspace – use `--workspace=channels` when installing deps or running scripts.
- Builds a federated bundle consumed by the server and plugins.

## Local Commands
- `npm run dev-server --workspace=channels` – hot-reload development server.
- `npm run build --workspace=channels` – production bundle (invokes webpack config in this folder).
- `npm run test --workspace=channels` / `npm run test:watch --workspace=channels`.
- `npm run check --workspace=channels` and `npm run fix --workspace=channels` for lint/style fixes.

## Directory Structure (src/)

```
src/
├── components/     # React components organized by feature (300+ subdirectories)
├── actions/        # Redux action creators (sync and async thunks)
├── selectors/      # Redux selectors for deriving state
├── reducers/       # Redux reducers for state management
├── utils/          # Utility functions and helpers
├── tests/          # Test utilities and helpers
├── i18n/           # Internationalization files
├── sass/           # Global SCSS styles and theme variables
├── types/          # TypeScript type definitions specific to the web app
├── store/          # Redux store configuration with redux-persist
├── plugins/        # Plugin integration points
├── packages/
│   └── mattermost-redux/  # Core Redux layer (actions, reducers, selectors)
├── entry.tsx       # Application entry point
└── root.tsx        # Root React component
```

## State Management
- **Redux + Redux Thunk**: Central state management using Redux with thunk middleware for async actions.
- **Redux Persist**: State persistence using localForage with cross-tab synchronization.
- **Mattermost Redux**: Core Redux logic (`state.entities.*` for server data).
- **State Views**: `state.views.*` for UI state (modals, sidebars, preferences).
- **Client4**: Singleton HTTP client for API requests. Should only be used in Redux actions.

## Key Files
- `package.json` – workspace-specific scripts, env vars, and browserlist targets.
- `webpack.config.js` – module federation + alias map; update remotes or exposes here only when necessary.
- `jest.config.js` – test roots, transformers, moduleNameMapper for workspace aliases.
- `tsconfig.json` – project references for `src`, `tests`, and embedded packages.

## TypeScript Configuration
- **Strict Mode**: TypeScript strict mode enabled with `strictNullChecks`
- **Path Aliases**: Configured for `@mattermost/*` packages and `mattermost-redux/*`
- **Composite Projects**: Uses TypeScript project references for workspace packages
- **No Any**: Avoid `any` types; legacy code may have them but new code should be typed

## Module Federation Notes
- Use `channels/src/module_registry.ts` to register async chunks; never import plugin remotes synchronously.
- Exposed modules must stay backward compatible; document any break in `webapp/README.md`.
- When adding a new remote, coordinate with server config (see `webpack.config.js` → `remotes`).
- Prefer wrapping plugin surfaces in adapter components so that federated boundaries remain stable.

## Dependencies & UI Stack
- React 18, Redux 5, React Router 5, React Intl, Floating UI, Compass Icons, Monaco.
- Follow `webapp/STYLE_GUIDE.md → Dependencies & Packages` before introducing new libs.
- `@mattermost/types`, `@mattermost/client`, and `platform/components` are first-party packages; import via full package names, not deep relative paths.

## Common Gotchas
- Postinstall builds platform packages—if TypeScript types feel stale, re-run `npm install` at repo root.
- Use `npm add <pkg> --workspace=channels` to avoid polluting other workspaces.
- Environment-specific overrides live in `config/` on the server side; do not hard-code URLs or feature flags here.
- Webpack aliases mirror tsconfig paths; keep both in sync when adding a new alias.

## References
- `webapp/STYLE_GUIDE.md → Automated Style Checking`, `Dependencies & Packages`.
- `webapp/README.md` for high-level architecture and release info.
