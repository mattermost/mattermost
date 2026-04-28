# CLAUDE: `webapp/platform/`

## Purpose
- Shared packages consumed by every Mattermost web experience (Channels, Boards, Playbooks, plugins).
- Changes here affect multiple products—coordinate across teams before merging.

## Packages

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@mattermost/types` | `types/` | TypeScript type definitions |
| `@mattermost/client` | `client/` | REST and WebSocket API client |
| `@mattermost/components` | `components/` | Shared React components |
| `@mattermost/eslint-plugin` | `eslint-plugin/` | Custom ESLint rules |

## Workspace Basics
- Each subpackage is its own npm workspace with independent `package.json`, tests, and build scripts.
- Run commands with `npm run <script> --workspace=@mattermost/<pkg>` (e.g., `@mattermost/client`).
- Versioning follows the monorepo; publishable artifacts come from CI pipelines.

## Import Convention
Always import using the full package name:

```typescript
// CORRECT
import {Client4} from '@mattermost/client';
// INCORRECT - never use relative paths
import Client4 from '../platform/client/src/client4';
```

## Build Relationship
Platform packages are automatically built on `npm install` via postinstall hook. Build order: `types` → `client`/`components`.

**Note**: When developing in `channels`, changes in `platform` packages may need a rebuild if not using a watcher that supports them.

## Adding Dependencies
When adding dependencies to platform packages:
```bash
npm add package-name --workspace=@mattermost/client
```

## Expectations
- Follow `webapp/STYLE_GUIDE.md`.
- Maintain 100% TypeScript coverage; no `any`.
- Update downstream consumers when making breaking changes.
