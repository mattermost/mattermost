# CLAUDE: `tests/`

## Purpose
- Centralizes shared test utilities, mocks, and sample data for the Channels webapp.
- Provides helpers so component and Redux tests stay concise and user-focused.

## Key Files
- `react_testing_utils.tsx`: Primary test utilities (exports `renderWithContext`, providers, custom matchers).
- `test_store.tsx`: Mock Redux store for testing.
- `setup_jest.ts`: Global Jest config and mocks.

## Testing Guidelines (RTL)
- **User-Centric**: Test interactions and visible behavior, not implementation.
- **No Snapshots**: Write explicit assertions with `expect(...).toBeVisible()`.
- **Accessible Selectors**: Prefer `getByRole` > `getByText` > `getByLabelText` > `getByTestId`.
- **userEvent**: Use `userEvent` over `fireEvent`, always await.

## renderWithContext
Always use `renderWithContext` for components that need Redux, Router, or I18n context:

```typescript
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('MyComponent', () => {
    it('renders correctly', async () => {
        const {container} = renderWithContext(
            <MyComponent prop="value" />,
            {
                entities: { users: { currentUserId: 'user1' } }, // Partial initial state
            },
        );
        expect(screen.getByRole('button')).toBeVisible();
    });
});
```

## Adding Helpers
- Place reusable mocks under `helpers/` (e.g., `intl-test-helper.tsx`, `match_media.mock.ts`).
- Document custom utilities with inline comments.
- If a helper becomes product-agnostic, consider moving it to `platform/components/testUtils.tsx`.

## Available Mocks
- `helpers/match_media.mock.ts`: matchMedia mock
- `helpers/localstorage.tsx`: localStorage mock
- `react-intl_mock.ts`: React Intl mock
- `react-router-dom_mock.ts`: React Router mock
