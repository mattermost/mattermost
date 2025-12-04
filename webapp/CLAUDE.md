# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Mattermost web app codebase, a React-based frontend application for the Mattermost collaboration platform. The repository is structured as an npm workspace monorepo with multiple packages, with the main application code in the `channels` package and shared platform code in `platform/*` packages.

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

This repository uses npm workspaces with the following structure:

### Main Application
- **channels** (`channels/`): The main Mattermost web app containing all UI components, Redux logic, and application code. See `channels/CLAUDE.md` for details.

### Platform Packages (Shared Libraries)
- **@mattermost/types** (`platform/types/`): TypeScript type definitions used across the application
- **@mattermost/client** (`platform/client/`): REST and WebSocket client for the Mattermost API
- **@mattermost/components** (`platform/components/`): Shared React components for multi-product architecture
- **@mattermost/eslint-plugin** (`platform/eslint-plugin/`): Custom ESLint rules
- **mattermost-redux** (`channels/src/packages/mattermost-redux/`): Redux state management (legacy internal package)

See `platform/CLAUDE.md` for more details on shared packages.

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

## Module Federation
The app uses webpack module federation for plugin architecture, allowing dynamic loading of remote modules at runtime.

## TypeScript
- **Strict Mode**: TypeScript strict mode enabled with `strictNullChecks`
- **Path Aliases**: Configured for `@mattermost/*` packages and `mattermost-redux/*`
- **Composite Projects**: Uses TypeScript project references for workspace packages
- **No Any**: Avoid `any` types; legacy code may have them but new code should be typed

## Dependencies to Note
- **React 18.2**: Main UI framework
- **Redux 5.0**: State management
- **React Router 5.3**: Client-side routing
- **React Intl**: Internationalization
- **Floating UI**: Tooltips and popovers (prefer `WithTooltip` component)
- **@mattermost/compass-icons**: Icon library (prefer these over font-awesome)
- **Monaco Editor**: Code editor integration
- **Styled Components**: Limited use (for MUI and some legacy components)

## Common Gotchas
- Platform packages (`platform/types`, `platform/client`, `platform/components`) are automatically built on `npm install` via postinstall hook
- Use workspace flag when adding dependencies: `npm add package-name --workspace=channels`
- Imports from platform packages work via TypeScript path mapping and Jest moduleNameMapper
- Use absolute paths/aliases for imports whenever possible
