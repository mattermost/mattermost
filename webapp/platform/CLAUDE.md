# CLAUDE: `webapp/platform/`

## Context
- Shared packages for Channels, Boards, Playbooks.
- **Versioning**: Monorepo lockstep.

## Packages
- `@mattermost/client`: REST/WebSocket singleton.
- `@mattermost/types`: TypeScript definitions (Server Entities).
- `@mattermost/components`: Shared UI (Modals, Loaders).
- `@mattermost/eslint-plugin`: Lint rules.

## Build
- **Auto-Build**: `npm install` runs postinstall to build these.
- **Watchers**: Changes here require rebuild/restart in `channels` unless using a watcher that detects `dist/` changes.

## Rules
- **Deps**: `npm add <pkg> --workspace=@mattermost/client`.
- **Imports**: ALWAYS full package name.
- **Types**: 100% coverage. No `any`.
