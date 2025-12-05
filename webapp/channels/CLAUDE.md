# CLAUDE: `webapp/channels/`

## Workspace Context
- **Scope**: Main web client. All UI/Redux logic.
- **Federation**: Builds a federated bundle. Use `module_registry.ts` for async chunks.

## Directory Structure
- `src/components/`: Feature UI.
- `src/actions/`: Redux actions (Thunks).
- `src/selectors/`: Redux selectors (Reselect).
- `src/reducers/`: State reducers.
- `src/packages/mattermost-redux/`: Core entity logic.

## Config
- `package.json`: Scripts, deps.
- `webpack.config.js`: Module Federation, Aliases.
- `tsconfig.json`: Strict null checks, Path aliases.

## Rules
- **State**:
  - `state.entities.*`: Server data (Users, Channels).
  - `state.views.*`: UI state (Modals, Sidebar).
- **Async**: Never import plugin remotes synchronously.
- **Deps**: `React 18`, `Redux 5`, `React Intl`, `Floating UI`, `Compass Icons`.
- **Common Gotcha**: If types are stale, run `npm install` at root to rebuild platform packages.
