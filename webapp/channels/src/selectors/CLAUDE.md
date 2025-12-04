# selectors/

Redux selectors for deriving state in the web app.

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

## views/ Subdirectory

Selectors for UI state from `state.views.*`:
- Modal visibility state
- Sidebar open/close state
- Current view selections

## Reference Implementations

- `drafts.ts`: Memoized selectors with createSelector
- `rhs.ts`: UI state selectors for right-hand sidebar
- `views/modals.ts`: Modal state selectors
