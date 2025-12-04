# tests/

Test utilities, helpers, and mocks for the web app.

## Key Files

- `react_testing_utils.tsx`: Primary test utilities (use this for all component tests)
- `test_store.tsx`: Mock Redux store for testing
- `setup_jest.ts`: Jest configuration and global mocks

## renderWithContext

Always use `renderWithContext` for components that need Redux, Router, or I18n context:

```typescript
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('MyComponent', () => {
    it('renders correctly', async () => {
        const {container} = renderWithContext(
            <MyComponent prop="value" />,
            {
                // Partial initial state (merged with defaults)
                entities: {
                    users: {
                        currentUserId: 'user1',
                    },
                },
            },
        );

        expect(screen.getByRole('button')).toBeVisible();
    });
});
```

### renderWithContext Options

```typescript
renderWithContext(component, initialState?, options?)

// Options:
{
    useMockedStore?: boolean;   // Use mock store (default: false)
    locale?: string;            // I18n locale (default: 'en')
    intlMessages?: Record<string, string>;
    history?: History;          // Custom history instance
}
```

### Updating State in Tests

```typescript
const {updateStoreState, replaceStoreState} = renderWithContext(<Component />);

// Merge new state with existing
updateStoreState({entities: {users: {currentUserId: 'user2'}}});

// Replace entire state
replaceStoreState(newInitialState);
```

## Testing Hooks

Use `renderHookWithContext` for testing custom hooks:

```typescript
import {renderHookWithContext} from 'tests/react_testing_utils';

const {result} = renderHookWithContext(
    () => useMyHook(args),
    initialState,
);
```

## Testing Philosophy

- **User-Centric**: Test user interactions and visible behavior, not implementation
- **No Snapshots**: Write explicit assertions with `expect(...).toBeVisible()`
- **Accessible Selectors**: Prefer `getByRole` > `getByText` > `getByLabelText` > `getByTestId`
- **userEvent**: Use `userEvent` over `fireEvent`, always await

```typescript
// GOOD
const user = userEvent.setup();
await user.click(screen.getByRole('button', {name: 'Submit'}));
expect(screen.getByText('Success')).toBeVisible();

// BAD
fireEvent.click(container.querySelector('.submit-btn'));
expect(wrapper.state().submitted).toBe(true);
```

## Available Mocks

- `helpers/match_media.mock.ts`: matchMedia mock
- `helpers/user_agent_mocks.ts`: User agent mocking
- `helpers/localstorage.tsx`: localStorage mock
- `react-intl_mock.ts`: React Intl mock
- `react-router-dom_mock.ts`: React Router mock

## helpers/ Subdirectory

- `intl-test-helper.tsx`: I18n testing utilities
- `date.ts`: Date mocking utilities
- `line_break_helpers.ts`: Text formatting test helpers

## Reference Files

- `react_testing_utils.tsx`: Full implementation of renderWithContext
- `test_store.tsx`: Mock store implementation
