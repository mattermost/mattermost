# Testing Patterns

**Analysis Date:** 2026-01-13

## Test Framework

**Backend (Go):**
- Runner: Go testing package (built-in)
- Config: Standard Go test conventions
- Run: `make test` or `go test ./...`

**Frontend (Jest):**
- Runner: Jest 30.1.3
- Config: `webapp/channels/jest.config.js`
- Assertion: Jest built-in expect
- Timeout: 60000ms

**E2E (Playwright):**
- Runner: Playwright 1.57.0
- Config: `e2e-tests/playwright/playwright.config.ts`
- Visual: Percy integration (`PERCY_TOKEN`)

**Run Commands:**
```bash
# Backend
make test                              # Run all Go tests
go test ./server/channels/app/...      # Run specific package
go test -v -run TestFunctionName       # Run specific test

# Frontend
npm test                               # Run all Jest tests
npm test -- --watch                    # Watch mode
npm test -- path/to/file.test.ts       # Single file
npm run test:coverage                  # Coverage report

# E2E
npm run test --prefix e2e-tests/playwright    # Run Playwright tests
npx playwright test specs/functional/         # Run functional tests
```

## Test File Organization

**Backend (Go):**
- Location: `*_test.go` alongside source files
- Pattern: Same directory as implementation
- Example: `server/channels/app/user.go` → `server/channels/app/user_test.go`

**Frontend (Jest):**
- Location: `*.test.ts(x)` alongside source files
- Alternative: `__tests__/` subdirectories for some modules
- Pattern: Component tests co-located with components

**E2E (Playwright):**
- Location: `e2e-tests/playwright/specs/`
- Organization by type:
  - `specs/functional/` - Feature tests
  - `specs/accessibility/` - A11y tests
  - `specs/visual/` - Visual regression tests
  - `specs/client/` - API client tests

**Structure:**
```
server/
  channels/
    app/
      user.go
      user_test.go
    store/
      sqlstore/
        user_store.go
        user_store_test.go

webapp/
  channels/
    src/
      components/
        about_build_modal/
          about_build_modal.tsx
          about_build_modal.test.tsx
      actions/
        channel_actions.ts
        channel_actions.test.ts
      hooks/
        useBurnOnReadTimer.ts
        useBurnOnReadTimer.test.ts

e2e-tests/
  playwright/
    specs/
      functional/
        channels/
          keyboard_shortcuts/
            shift_up_shortcut.spec.ts
      accessibility/
        channels/
          account_menu_keyboard.spec.ts
```

## Test Structure

**Go Test Structure:**
```go
func TestFunctionName(t *testing.T) {
    // Setup
    th := Setup(t)
    defer th.TearDown()

    // Test cases
    t.Run("success case", func(t *testing.T) {
        result, err := th.App.FunctionName(input)
        require.NoError(t, err)
        assert.Equal(t, expected, result)
    })

    t.Run("error case", func(t *testing.T) {
        _, err := th.App.FunctionName(invalidInput)
        require.Error(t, err)
    })
}
```

**Jest Test Structure:**
```typescript
import {renderWithContext} from 'tests/react_testing_utils';

describe('ComponentName', () => {
    beforeEach(() => {
        // Reset state
    });

    it('should handle valid input', async () => {
        // Arrange
        const props = createTestProps();

        // Act
        const {getByRole} = renderWithContext(<Component {...props} />);
        await userEvent.click(getByRole('button'));

        // Assert
        expect(getByRole('dialog')).toBeVisible();
    });

    it('should throw on invalid input', () => {
        expect(() => functionCall(null)).toThrow('Invalid input');
    });
});
```

**Playwright Test Structure:**
```typescript
import {test, expect} from '@e2e-support/test_fixture';

test.describe('Feature Name', () => {
    /**
     * @objective Verify that user can perform action
     * @precondition User is logged in
     */
    test('should complete action successfully', async ({pw, page}) => {
        // # Navigate to page
        await page.goto('/channels/town-square');

        // # Perform action
        await page.getByRole('button', {name: 'Submit'}).click();

        // * Verify result
        await expect(page.getByText('Success')).toBeVisible();
    });
});
```

**Patterns:**
- Use `beforeEach` for per-test setup
- Use `afterEach` to restore mocks
- Explicit arrange/act/assert comments in complex tests
- One assertion focus per test (multiple expects OK)

## Mocking

**Go Mocking:**
- Use interfaces for testability
- Mock stores via interface implementations
- `TestHelper` struct for common setup

**Jest Mocking:**
```typescript
import {vi} from 'vitest';

// Mock module
vi.mock('@mattermost/client', () => ({
    Client4: {
        getUser: vi.fn(),
    },
}));

// Mock in test
const mockGetUser = vi.mocked(Client4.getUser);
mockGetUser.mockResolvedValue({id: 'user-id', username: 'testuser'});
```

**What to Mock:**
- External APIs and services
- File system operations
- Network calls
- Time/dates (use fake timers)
- Redux store (via `renderWithContext`)

**What NOT to Mock:**
- Internal pure functions
- Simple utilities
- TypeScript types

## Fixtures and Factories

**Go Test Data:**
```go
// TestHelper provides test utilities
func Setup(t *testing.T) *TestHelper {
    th := &TestHelper{}
    th.App = setupApp(t)
    th.BasicUser = th.CreateUser()
    th.BasicTeam = th.CreateTeam()
    th.BasicChannel = th.CreateChannel()
    return th
}
```

**Jest Test Data:**
```typescript
// Factory functions
function createTestUser(overrides?: Partial<UserProfile>): UserProfile {
    return {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        ...overrides,
    };
}

// TestHelper for channel mocks
import {TestHelper} from 'tests/helpers/client-test-helper';
const channel = TestHelper.getChannelMock();
```

**Location:**
- Go: Test helpers in `*_test.go` or shared `testlib/` package
- Jest: Factory functions in test file or `tests/helpers/`
- Playwright: Page objects in `lib/src/ui/pages/`

## Coverage

**Requirements:**
- No enforced coverage target
- Focus on critical paths (API, store, business logic)
- Coverage tracked for awareness

**Configuration:**
- Jest: `collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}']`
- Exclusions: Test files, config files

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Single function/component in isolation
- Mocking: Mock all external dependencies
- Speed: Fast (<100ms per test)
- Examples: `server/channels/app/*_test.go`, `webapp/channels/src/**/*.test.tsx`

**Integration Tests:**
- Scope: Multiple modules together
- Mocking: Mock only external boundaries
- Examples: Store tests with real DB, Redux action tests

**E2E Tests:**
- Framework: Playwright (primary), Cypress (legacy)
- Scope: Full user flows
- Location: `e2e-tests/playwright/specs/`
- Tags: `@visual` for visual tests

## Common Patterns

**Async Testing (Jest):**
```typescript
it('should handle async operation', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected');
});
```

**Error Testing:**
```typescript
// Sync error
it('should throw on invalid input', () => {
    expect(() => parse(null)).toThrow('Cannot parse null');
});

// Async error
it('should reject on failure', async () => {
    await expect(asyncCall()).rejects.toThrow('Error message');
});
```

**React Testing Library Selectors:**
```typescript
// Prefer accessible selectors (in order)
getByRole('button', {name: 'Submit'})   // Best
getByText('Submit')                      // Good
getByPlaceholderText('Enter name')       // Good
getByLabelText('Username')               // Good
getByTestId('submit-button')             // Last resort
```

**User Interactions:**
```typescript
import userEvent from '@testing-library/user-event';

// Always await userEvent methods
await userEvent.click(button);
await userEvent.type(input, 'text');
await userEvent.keyboard('{Enter}');
```

**Playwright Comment Conventions:**
```typescript
// # Action - describes test step
await page.click('button');

// * Verification - describes assertion
await expect(element).toBeVisible();
```

**Snapshot Testing:**
- Not used (deprecated pattern)
- Prefer explicit `expect().toBeVisible()` assertions

## Test Documentation (Playwright)

**Required Format:**
```typescript
/**
 * @objective Clear description of what the test verifies
 * @precondition (optional) Special setup requirements
 */
test('MM-T1234 descriptive test name', async ({pw}) => {
    // Test implementation
});
```

**Naming:**
- Action-oriented titles
- Optional Jira key prefix: `MM-T1234`
- Descriptive of expected behavior

---

*Testing analysis: 2026-01-13*
*Update when test patterns change*
