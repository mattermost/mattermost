# channels/

The main Mattermost web application package containing all UI components, Redux state management, and application logic.

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

## TypeScript Configuration

- **Strict Mode**: TypeScript strict mode enabled with `strictNullChecks`
- **Path Aliases**: Configured for `@mattermost/*` packages and `mattermost-redux/*`
- **Composite Projects**: Uses TypeScript project references for workspace packages
- **No Any**: Avoid `any` types; legacy code may have them but new code should be typed

See `tsconfig.json` for full configuration.

## Module Federation

The app uses webpack module federation for plugin architecture, allowing dynamic loading of remote modules at runtime. Configuration is in `webpack.config.js`.

## State Management Overview

- **Redux + Redux Thunk**: Central state management with thunk middleware for async actions
- **Redux Persist**: State persistence using localForage with cross-tab synchronization
- **State Split**:
  - `state.entities.*`: Server-sourced data (users, channels, posts, teams)
  - `state.views.*`: Web app UI state (modals, sidebars, preferences)

## Key Configuration Files

- `webpack.config.js`: Webpack configuration with module federation
- `jest.config.js`: Jest test configuration
- `tsconfig.json`: TypeScript configuration
- `.eslintrc.json`: ESLint configuration
