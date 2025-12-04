# @mattermost/types

TypeScript type definitions for Mattermost entities and API responses.

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



