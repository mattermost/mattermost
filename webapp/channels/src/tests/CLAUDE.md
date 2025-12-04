# CLAUDE: `tests/`

Test utilities, helpers, and mocks for the web app.

## Purpose

- Centralizes shared test utilities, mocks, and sample data for the Channels webapp
- Provides helpers so component and Redux tests stay concise and user-focused

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

## Testing Guidelines

- Follow `webapp/STYLE_GUIDE.md → Testing`
- Use React Testing Library + `userEvent` for UI; avoid Enzyme and DOM snapshots
- Prefer accessible queries: `getByRole`, `getByText`, etc.
- Keep async tests `await`ing user interactions; wrap manual async flows in `act` only when RTL helpers do not
- Store-specific tests should assert visible outcomes rather than internal Redux state

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
- `admin_console_plugin_index_sample_plugins.ts`: Data fixtures

## Adding Helpers

- Place reusable mocks under `helpers/`
- Document custom utilities with inline comments so future updates remain safe
- If a helper becomes product-agnostic, consider moving it to `platform/components/testUtils.tsx`

## Reference Files

- `react_testing_utils.tsx`: Full implementation of renderWithContext
- `test_store.tsx`: Mock store implementation
- `performance_mock.test.ts`: Example of integration performance testing
