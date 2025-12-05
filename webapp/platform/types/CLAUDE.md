# CLAUDE: `platform/types/`

## Context
- Package: `@mattermost/types`
- Role: Shared TypeScript definitions for Server Entities.

## Rules
- **Source**: Match Server REST API structs (snake_case).
- **Organization**: Domain-based files (`users.ts`, `channels.ts`).
- **Types**: Use `type` (not `interface`). Use `readonly` for immutables.
- **IDs**: Always `string`.
- **Time**: Always `number` (ms).

## Usage
Import via subpath:
```typescript
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
```
