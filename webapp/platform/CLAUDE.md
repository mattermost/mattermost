# Platform Packages CLAUDE.md

## Overview
The `platform/` directory contains shared libraries used by the main web app (`channels`) and potentially other Mattermost products. These are managed as npm workspaces.

## Packages
- **@mattermost/types** (`types/`): TypeScript type definitions used across the application.
- **@mattermost/client** (`client/`): REST and WebSocket client for the Mattermost API. See `client/CLAUDE.md`.
- **@mattermost/components** (`components/`): Shared React components for multi-product architecture.
- **@mattermost/eslint-plugin** (`eslint-plugin/`): Custom ESLint rules.

## Importing Rules
Always import packages using their full npm package name, never relative paths.

**Correct:**
```typescript
import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';
```

**Incorrect:**
```typescript
import Client4 from '../platform/client/src/client4.ts';
```

## Build Notes
- Platform packages are automatically built on `npm install` via a postinstall hook.
- When developing in `channels`, changes in `platform` packages may need a rebuild if not using a watcher that supports them (Webpack in `channels` handles this via aliases usually, but be aware of `dist` vs `src`).



