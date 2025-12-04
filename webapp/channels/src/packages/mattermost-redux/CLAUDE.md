# CLAUDE: `packages/mattermost-redux/`

Core Redux state management package for server-sourced data. This is an embedded package that manages `state.entities.*`.

## Purpose

This package handles:
- Server entity data (users, channels, posts, teams, etc.)
- API actions that fetch/mutate server data
- Selectors for accessing entity data
- Reducers that normalize and store server responses

## When to Edit

- Add/modify server-sourced entities (`state.entities.*`), request status tracking, or shared selectors
- Introduce new Client4 endpoints (paired with `platform/client`) or action helpers
- Avoid webapp-specific logic; keep files reusable across products (Channels, Boards, Playbooks)

## Directory Structure (src/)

```
src/
├── actions/          # API actions (channels.ts, users.ts, posts.ts, etc.)
├── action_types/     # Action type constants
├── reducers/
│   ├── entities/     # Entity reducers (one per domain)
│   └── requests/     # Request status tracking
├── selectors/
│   ├── entities/     # Entity selectors
│   └── create_selector/  # Memoized selector helper
├── constants/        # App constants
├── store/            # Store configuration helpers
├── utils/            # Utility functions
└── client/           # Client4 re-export
```

## State Organization

All state managed here lives under `state.entities`:

```typescript
state.entities.users        // User profiles, statuses
state.entities.channels     // Channel data, membership
state.entities.posts        // Posts, reactions
state.entities.teams        // Team data, membership
state.entities.preferences  // User preferences
// ... etc
```

Additional state slices:
- `state.requests`: Tracks the status of network requests (loading, success, failure)
- `state.errors`: Global error state

**Note**: UI-specific state (modals, expanded sidebars, form state) lives outside this package in `state.views` (see `../../reducers/views/`).

## Import Convention

Import from mattermost-redux using the package alias:

```typescript
// Actions
import {getUser} from 'mattermost-redux/actions/users';

// Selectors
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

// Constants
import {General} from 'mattermost-redux/constants';

// Types come from @mattermost/types
import {UserProfile} from '@mattermost/types/users';
```

## Conventions

- All async actions return `{data}` or `{error}` objects; keep request statuses updated via `RequestTypes`
- When adding endpoints, update `client/index.ts`, Types, and relevant action/reducer files
- Maintain TypeScript strictness; add tests under `__tests__` where behaviors are complex
- Coordinate API contracts with server changes; document required server versions in commit/PR descriptions

## Adding New Entities

1. Create action types in `action_types/`
2. Create reducer in `reducers/entities/`
3. Register reducer in `reducers/entities/index.ts`
4. Create selectors in `selectors/entities/`
5. Create actions in `actions/`

## Relationship to channels/

- `mattermost-redux`: Server data (`state.entities.*`)
- `channels/src/actions/`: Web app actions (may compose mattermost-redux actions)
- `channels/src/selectors/`: Web app selectors (may compose mattermost-redux selectors)
- `channels/src/reducers/views/`: UI state (`state.views.*`)

## References

- `src/actions/channels.ts`, `src/selectors/entities/channels.ts`, `src/utils/post_list.ts` – representative files
- `webapp/STYLE_GUIDE.md → Redux & Data Fetching`, `Networking`
