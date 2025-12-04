# CLAUDE: `selectors/`

Redux selectors for deriving state in the web app.

## Purpose

- Derive memoized data from Redux state for use in components, hooks, and actions
- Keep state computations centralized to avoid duplication and unnecessary renders

## Directory Structure

```
selectors/
├── *.ts              # Domain-specific selectors (drafts.ts, rhs.ts, etc.)
└── views/            # UI state selectors matching views/ reducers
```

## Memoization Requirements

### When to Memoize

Selectors that return **new objects or arrays** must use `createSelector` from reselect:

```typescript
import {createSelector} from 'mattermost-redux/selectors/create_selector';

// BAD - creates new array on every call, causes re-renders
export const getVisibleChannels = (state: GlobalState) => {
    return Object.values(state.entities.channels.channels).filter(c => c.visible);
};

// GOOD - memoized, only recalculates when input changes
export const getVisibleChannels = createSelector(
    'getVisibleChannels',
    (state: GlobalState) => state.entities.channels.channels,
    (channels) => Object.values(channels).filter(c => c.visible),
);
```

### Selector Factories

When a selector takes arguments, use a `makeGet...` factory for per-instance memoization:

```typescript
// Factory creates a new memoized selector instance
export function makeGetChannel() {
    return createSelector(
        'getChannel',
        (state: GlobalState) => state.entities.channels.channels,
        (state: GlobalState, channelId: string) => channelId,
        (channels, channelId) => channels[channelId],
    );
}
```

### Using Factories in Components

```typescript
// Functional component - memoize the selector instance
function ChannelItem({channelId}: Props) {
    const getChannel = useMemo(makeGetChannel, []);
    const channel = useSelector((state) => getChannel(state, channelId));
}

// Class component - use makeMapStateToProps
const makeMapStateToProps = () => {
    const getChannel = makeGetChannel();
    return (state: GlobalState, ownProps: OwnProps) => ({
        channel: getChannel(state, ownProps.channelId),
    });
};
```

## Naming & Structure

- `selectors/posts.ts` – canonical example for feed computations
- `selectors/views/channel_sidebar.ts` – pattern for per-view selectors
- Keep test files next to implementation (`*.test.ts`) to document memoization expectations

## Usage Rules

- Avoid cross-imports from reducers or store. Selectors should depend only on state shape and other selectors
- When tapping `mattermost-redux` selectors, re-export or compose them locally for clarity
- Document any selector that relies on specific state initialization (e.g., persisted drafts) in code comments

## views/ Subdirectory

Selectors for UI state from `state.views.*`:
- Modal visibility state
- Sidebar open/close state
- Current view selections

## Reference Implementations

- `drafts.ts`: Memoized selectors with createSelector
- `rhs.ts`: UI state selectors for right-hand sidebar
- `views/modals.ts`: Modal state selectors
- `views/threads.ts`, `posts.ts`: Example factories
