# CLAUDE: `webapp/platform/`

Shared packages used across the Mattermost web application and potentially other products (Channels, Boards, Playbooks, plugins).

## Purpose

- Shared packages consumed by every Mattermost web experience
- Changes here affect multiple products—coordinate across teams before merging

## Packages

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@mattermost/types` | `types/` | TypeScript type definitions |
| `@mattermost/client` | `client/` | REST and WebSocket API client |
| `@mattermost/components` | `components/` | Shared React components |
| `@mattermost/eslint-plugin` | `eslint-plugin/` | Custom ESLint rules |

## Workspace Basics

- Each subpackage is its own npm workspace with independent `package.json`, tests, and build scripts
- Run commands with `npm run <script> --workspace=@mattermost/<pkg>` (e.g., `@mattermost/client`)
- Versioning follows the monorepo; publishable artifacts come from CI pipelines

## Import Convention

Always import using the full package name:

```typescript
// CORRECT
import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';
import {GenericModal} from '@mattermost/components';

// INCORRECT - never use relative paths
import Client4 from '../platform/client/src/client4';
```

## Build Relationship

Platform packages are automatically built on `npm install` via postinstall hook. The build order ensures dependencies are available:

1. `@mattermost/types` (no dependencies)
2. `@mattermost/client` (depends on types)
3. `@mattermost/components` (depends on types)

## Adding Dependencies

When adding dependencies to platform packages:

```bash
npm add package-name --workspace=@mattermost/client
```

## Which Package for What?

- **New TypeScript types**: `@mattermost/types`
- **New API endpoints**: `@mattermost/client`
- **Shared UI components**: `@mattermost/components`
- **Custom lint rules**: `@mattermost/eslint-plugin`
- **Web app specific code**: `channels/` (not platform)

## TypeScript Configuration

Each package has its own `tsconfig.json` that:
- References `@mattermost/types` via project references
- Outputs to a `dist/` directory
- Is configured for library consumption

## Expectations

- Follow `webapp/STYLE_GUIDE.md` plus package READMEs for implementation details
- Maintain 100% TypeScript coverage; no `any` unless justified with TODO links
- Update downstream consumers when making breaking changes; document upgrade steps in PRs

## Testing

Each package has its own Jest configuration:

```bash
npm run test --workspace=@mattermost/client
```

## References

- `platform/README.md` – high-level orientation
- Individual README files per package (e.g., `platform/components/README.md`)
