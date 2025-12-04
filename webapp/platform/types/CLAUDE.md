# CLAUDE: `platform/types/` (`@mattermost/types`)

TypeScript type definitions for Mattermost entities and API responses.

## Purpose

- Shared TypeScript definitions for server entities, API payloads, and enums consumed across all Mattermost frontends

## Structure

```
src/
├── users.ts           # User profiles, statuses
├── channels.ts        # Channels, channel membership
├── posts.ts           # Posts, post metadata
├── teams.ts           # Teams, team membership
├── files.ts           # File uploads, file info
├── preferences.ts     # User preferences
├── config.ts          # Server configuration
├── roles.ts           # Permissions and roles
├── integrations.ts    # Webhooks, slash commands
├── plugins.ts         # Plugin types
├── ... (50+ type files)
└── utilities.ts       # Utility types (DeepPartial, etc.)
```

## Import Convention

Import types using subpath exports:

```typescript
// Import specific entity types
import {UserProfile, UserStatus} from '@mattermost/types/users';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {Post} from '@mattermost/types/posts';

// Import utility types
import {DeepPartial} from '@mattermost/types/utilities';
```

## Guidelines

- Keep files organized by domain (users, channels, teams, emojis, etc.)
- Maintain compatibility with server REST APIs; align naming and shapes with server structs
- Export granular types so downstream apps can tree-shake (`UserProfile`, `Channel`, `TeamUnread`)
- Avoid duplicating types present elsewhere in the monorepo; reference these definitions instead

## Adding New Types

1. Find or create the appropriate file in `src/`
2. Export the type from that file
3. Types are automatically available via subpath exports

```typescript
// src/something.ts
export type Something = {
    id: string;
    name: string;
    created_at: number;
};

// Usage
import {Something} from '@mattermost/types/something';
```

## Type Conventions

- Use `type` over `interface` for consistency
- Property names use `snake_case` (matching API responses)
- Timestamps are `number` (milliseconds since epoch)
- IDs are `string`
- Use `readonly` for immutable properties where appropriate
- Provide JSDoc comments for exported interfaces to improve IntelliSense

## Workflow

- Update types when server contracts change. Coordinate with backend PRs and document minimum server versions
- Incrementally add stricter types (e.g., string literal unions) but ensure backward compatibility for older data
- Run TypeScript builds/tests for dependent workspaces (`channels`, `platform/client`) after modifying shared types

## Relationship to channels/src/types/

- **@mattermost/types**: Server entities and API types (shared across packages)
- **channels/src/types/**: Web app-specific types (GlobalState, component props, etc.)

Web app types may import from `@mattermost/types` but not vice versa.

## Common Entity Types

| Type | File | Description |
|------|------|-------------|
| `UserProfile` | `users.ts` | User account data |
| `Channel` | `channels.ts` | Channel data |
| `Post` | `posts.ts` | Message post |
| `Team` | `teams.ts` | Team data |
| `FileInfo` | `files.ts` | Uploaded file metadata |
| `PreferenceType` | `preferences.ts` | User preference |

## Testing & Validation

- Add targeted tests or sample builders when modifying complex unions
- Run TypeScript builds for dependent workspaces after changes

## References

- `src/users.ts`, `src/channels.ts`, `src/teams.ts`
- `webapp/STYLE_GUIDE.md → TypeScript`, "Component Prop Typing"
