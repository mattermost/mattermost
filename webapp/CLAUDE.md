# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Mattermost web app codebase, a React-based frontend application for the Mattermost collaboration platform. The repository is structured as an npm workspace monorepo with multiple packages, with the main application code in the `channels` package and shared platform code in `platform/*` packages.

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

## Build & Development Commands

### Installation
```bash
npm install          # Install all dependencies (includes postinstall build of platform packages)
```

### Development
```bash
make run             # Start webpack in watch mode (production build)
make dev             # Start webpack-dev-server (recommended for development)
npm run dev-server   # Alternative to `make dev`
```

### Building
```bash
make dist            # Build all packages for production
npm run build        # Build from root (builds all workspaces)
npm run build --workspace=channels  # Build specific workspace
```

### Testing
```bash
make test            # Run all tests across workspaces
npm run test --workspace=channels   # Run tests for specific workspace
npm run test:watch --workspace=channels  # Watch mode for development
npm run test:updatesnapshot --workspace=channels  # Update snapshots
```

### Linting & Type Checking
```bash
make check-style     # Run ESLint (quiet mode, cached)
make fix-style       # Auto-fix ESLint issues
make check-types     # Run TypeScript type checking across all workspaces
npm run check --workspace=channels   # ESLint + Stylelint for channels
npm run fix --workspace=channels     # Auto-fix for channels
```

### Cleaning
```bash
make clean           # Remove all build artifacts and node_modules
npm run clean --workspaces --if-present  # Clean all workspace build artifacts
```

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

## Important Configuration Files

- `channels/webpack.config.js`: Webpack configuration with module federation
- `channels/jest.config.js`: Jest test configuration
- `channels/tsconfig.json`: TypeScript configuration with workspace references
- `channels/.eslintrc.json`: ESLint configuration

## Common Gotchas

- Platform packages are automatically built on `npm install` via postinstall hook
- Use workspace flag when adding dependencies: `npm add package-name --workspace=channels`
- Imports from platform packages work via TypeScript path mapping and Jest moduleNameMapper
- Test files must use `renderWithContext` from `tests/react_testing_utils` to provide necessary context providers
