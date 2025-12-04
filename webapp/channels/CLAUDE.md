# Channels Workspace CLAUDE.md

## Overview
The `channels` workspace contains the main Mattermost web application, including UI components, Redux logic, and application code.

## Directory Structure (`src/`)
- **components/**: React components organized by feature. See `src/components/CLAUDE.md`.
- **actions/**: Redux action creators. See `src/actions/CLAUDE.md`.
- **selectors/**: Redux selectors. See `src/selectors/CLAUDE.md`.
- **reducers/**: Redux reducers for state management.
- **utils/**: Utility functions and helpers.
- **i18n/**: Internationalization files.
- **sass/**: Global SCSS styles and theme variables.
- **types/**: TypeScript type definitions specific to the web app.
- **store/**: Redux store configuration with redux-persist.
- **plugins/**: Plugin integration points.
- **packages/mattermost-redux/**: Redux layer (actions, reducers, selectors, utilities). See `src/packages/mattermost-redux/CLAUDE.md`.

## State Management
- **Redux + Redux Thunk**: Central state management using Redux with thunk middleware for async actions.
- **Redux Persist**: State persistence using localForage with cross-tab synchronization.
- **Mattermost Redux**: Core Redux logic.
  - `state.entities.*`: Server-sourced data (users, channels, posts, etc.)
  - `state.views.*`: Web app UI state (modals, sidebars, preferences)
- **Client4**: Singleton HTTP client for API requests. Should only be used in Redux actions.

## Important Files
- `webpack.config.js`: Webpack configuration with module federation.
- `jest.config.js`: Jest test configuration.
- `tsconfig.json`: TypeScript configuration with workspace references.
- `.eslintrc.json`: ESLint configuration.
- `../STYLE_GUIDE.md`: Comprehensive style guide.

## Testing
- **React Testing Library**: Use RTL for all new component tests.
- **Context**: Test files must use `renderWithContext` from `utils/react_testing_utils` to provide necessary context providers.
- **Snapshots**: Avoid snapshot tests. Write explicit assertions (e.g., `expect(...).toBeVisible()`).

## Development Commands (Workspace)
```bash
npm run build --workspace=channels    # Build this workspace
npm run check --workspace=channels    # Lint
npm run fix --workspace=channels      # Fix linting
npm run test --workspace=channels     # Run tests
```



