# CLAUDE: `selectors/`

## Purpose
- Derive memoized data from Redux state for use in components, hooks, and actions.
- Keep state computations centralized to avoid duplication and unnecessary renders.

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

// GOOD - memoized
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
```

## Usage Rules
- Avoid cross-imports from reducers or store. Selectors should depend only on state shape and other selectors.
- When tapping `mattermost-redux` selectors, re-export or compose them locally for clarity.
- Document any selector that relies on specific state initialization (e.g., persisted drafts) in code comments.

## References
- `webapp/STYLE_GUIDE.md → Redux & Data Fetching → Selectors`.
- `drafts.ts`: Memoized selectors with createSelector.
- `views/modals.ts`: Modal state selectors.
