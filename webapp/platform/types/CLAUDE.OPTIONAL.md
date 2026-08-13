# CLAUDE: `platform/types/` (`@mattermost/types`)

## Purpose
- Shared TypeScript definitions for server entities, API payloads, and enums consumed across all Mattermost frontends.

## Structure
Files organized by domain in `src/`:
- `users.ts`, `channels.ts`, `posts.ts`, `teams.ts`, `files.ts`, `preferences.ts`, `config.ts`.
- `utilities.ts` (DeepPartial, etc.).

## Import Convention
Import types using subpath exports:

```typescript
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
```

## Type Conventions
- Use `type` over `interface` for consistency.
- Property names use `snake_case` (matching API responses).
- Timestamps are `number` (milliseconds since epoch).
- IDs are `string`.
- Use `readonly` for immutable properties where appropriate.

## Guidelines
- Maintain compatibility with server REST APIs; align naming and shapes with server structs.
- Export granular types so downstream apps can tree-shake.
- Avoid duplicating types present elsewhere in the monorepo.

## Workflow
- Update types when server contracts change.
- Incrementally add stricter types but ensure backward compatibility.
- Run TypeScript builds/tests for dependent workspaces after modifying shared types.
