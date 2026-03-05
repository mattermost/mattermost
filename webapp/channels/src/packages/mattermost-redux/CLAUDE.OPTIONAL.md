# CLAUDE: `packages/mattermost-redux/`

## Purpose
- Embedded copy of the `mattermost-redux` package for local development.
- Owns canonical Redux entities, actions, selectors, and request helpers shared across products (Channels, Boards, Playbooks).
- Manages server-sourced data (`state.entities.*`) and API actions.

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
All state managed here lives under `state.entities` (users, channels, posts, teams, etc.).
- **state.entities**: Server-sourced data.
- **state.requests**: Network request tracking.
- **state.errors**: Global errors.

UI-specific state lives outside this package in `state.views`.

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

## When to Edit
- Add/modify server-sourced entities (`state.entities.*`), request status tracking, or shared selectors.
- Introduce new Client4 endpoints (paired with `platform/client`) or action helpers.
- Avoid webapp-specific logic; keep files reusable across products.

## Adding New Entities
1. Create action types in `action_types/`
2. Create reducer in `reducers/entities/`
3. Register reducer in `reducers/entities/index.ts`
4. Create selectors in `selectors/entities/`
5. Create actions in `actions/`

## Conventions
- All async actions return `{data}` or `{error}` objects; keep request statuses updated via `RequestTypes`.
- When adding endpoints, update `client/index.ts`, Types, and relevant action/reducer files.
- Maintain TypeScript strictness; add tests under `__tests__` where behaviors are complex.
- Coordinate API contracts with server changes; document required server versions in commit/PR descriptions.
