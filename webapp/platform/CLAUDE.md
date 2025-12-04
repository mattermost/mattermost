# platform/

Shared packages used across the Mattermost web application and potentially other products.

## Packages

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@mattermost/types` | `types/` | TypeScript type definitions |
| `@mattermost/client` | `client/` | REST and WebSocket API client |
| `@mattermost/components` | `components/` | Shared React components |
| `@mattermost/eslint-plugin` | `eslint-plugin/` | Custom ESLint rules |

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

## Testing

Each package has its own Jest configuration:
```bash
npm run test --workspace=@mattermost/client
```
