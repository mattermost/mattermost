# Testing Patterns

**Analysis Date:** 2026-01-21

## Test Frameworks

### Go (Server)

**Runner:**
- Go's built-in `testing` package
- Run with `go test ./...`

**Assertion Library:**
- `github.com/stretchr/testify/assert` - soft assertions (test continues)
- `github.com/stretchr/testify/require` - hard assertions (test stops)
- `github.com/stretchr/testify/mock` - mocking

**Run Commands:**
```bash
# Run all server tests
cd server && go test ./...

# Run specific package tests
go test ./channels/app/...

# Run with verbose output
go test -v ./channels/app/recap_test.go

# Run with coverage
go test -cover ./channels/app/...
```

### TypeScript (Frontend)

**Runner:**
- Jest (v29+)
- Config: `webapp/channels/jest.config.js`

**Assertion Library:**
- Jest built-in assertions
- `@testing-library/jest-dom` for DOM assertions

**Run Commands:**
```bash
cd webapp/channels

# Run all tests
npm test

# Watch mode
npm run test:watch

# Update snapshots
npm run test:updatesnapshot

# CI mode with coverage
npm run test-ci

# Debug mode
npm run test:debug
```

## Test File Organization

### Go

**Location:** Co-located with source files
- Source: `server/channels/app/recap.go`
- Test: `server/channels/app/recap_test.go`

**Naming:** `{source_file}_test.go`

**Structure:**
```
server/channels/
├── app/
│   ├── recap.go
│   └── recap_test.go
├── api4/
│   └── recap.go
├── store/
│   └── sqlstore/
│       ├── recap_store.go
│       └── recap_store_test.go
└── jobs/
    └── recap/
        ├── worker.go
        └── worker_test.go
```

### TypeScript

**Location:** Co-located with source files
- Source: `webapp/channels/src/components/recaps/recap_channel_card.tsx`
- Test: `webapp/channels/src/components/recaps/recap_channel_card.test.tsx`

**Naming:** `{component_name}.test.tsx`

**Structure:**
```
webapp/channels/src/
├── components/
│   └── recaps/
│       ├── recap_channel_card.tsx
│       ├── recap_channel_card.test.tsx
│       ├── recaps_list.tsx
│       └── recaps_list.test.tsx
├── packages/
│   └── mattermost-redux/
│       └── src/
│           ├── actions/
│           │   └── recaps.ts
│           └── selectors/
│               └── entities/
│                   └── recaps.ts
└── tests/
    ├── setup_jest.ts
    ├── react_testing_utils.tsx
    └── test_store.ts
```

## Test Structure

### Go Suite Organization

```go
// Copyright header (required)
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
    "testing"

    "github.com/mattermost/mattermost/server/public/model"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestCreateRecap(t *testing.T) {
    // Feature flag setup for integration tests
    os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
    defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

    // Test helper setup
    th := Setup(t).InitBasic(t)

    t.Run("create recap with valid channels", func(t *testing.T) {
        // Arrange
        channel2 := th.CreateChannel(t, th.BasicTeam)
        channelIds := []string{th.BasicChannel.Id, channel2.Id}
        ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

        // Act
        recap, err := th.App.CreateRecap(ctx, "My Test Recap", channelIds, "test-agent-id")

        // Assert
        require.Nil(t, err)
        require.NotNil(t, recap)
        assert.Equal(t, th.BasicUser.Id, recap.UserId)
        assert.Equal(t, model.RecapStatusPending, recap.Status)
    })

    t.Run("create recap with channel user is not member of", func(t *testing.T) {
        // ... negative test case
    })
}
```

**Patterns:**
- Use `t.Run()` for subtests
- Name subtests descriptively: "create recap with valid channels"
- Use `require` for setup failures (stops test)
- Use `assert` for actual assertions (continues test)
- Clean up with `defer`

### TypeScript Suite Organization

```typescript
// Copyright header (required)
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {RecapChannel} from '@mattermost/types/recaps';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import RecapChannelCard from './recap_channel_card';

// Mock setup at top of file
jest.mock('mattermost-redux/actions/channels', () => ({
    readMultipleChannels: jest.fn((channelIds) => ({type: 'READ_MULTIPLE_CHANNELS', channelIds})),
}));

describe('RecapChannelCard', () => {
    // Shared test data
    const mockChannel = TestHelper.getChannelMock({...});
    const baseState = {
        entities: {
            channels: {...},
            teams: {...},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render channel name', () => {
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        expect(screen.getByText('test-channel')).toBeInTheDocument();
    });

    test('should dispatch action when button clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(<RecapChannelCard channel={mockRecapChannel}/>, baseState);

        await user.click(screen.getByText('test-channel'));

        expect(mockDispatch).toHaveBeenCalled();
    });
});
```

**Patterns:**
- Use `describe` blocks for logical grouping
- Use `test()` (not `it()`) for individual tests
- Use `beforeEach` for mock cleanup
- Descriptive test names: "should render channel name"
- Async tests use `userEvent.setup()` and `await`

## Mocking

### Go Mocking

**Framework:** `github.com/stretchr/testify/mock`

**Mock Generation:** Store mocks in `server/channels/store/storetest/mocks/`

**Patterns:**
```go
// Create mock store
mockStore := &mocks.Store{}
mockRecapStore := &mocks.RecapStore{}
mockStore.On("Recap").Return(mockRecapStore)

// Setup expectations
mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)

// Match with custom matcher
mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
    return r.TotalMessageCount == 15 && r.Status == model.RecapStatusCompleted
})).Return(recap, nil)

// Verify calls
mockApp.AssertExpectations(t)
```

**App Mock Interface Pattern:**
```go
type MockAppIface struct {
    mock.Mock
}

func (m *MockAppIface) ProcessRecapChannel(rctx request.CTX, recapID, channelID, userID, agentID string) (*model.RecapChannelResult, *model.AppError) {
    args := m.Called(rctx, recapID, channelID, userID, agentID)
    if args.Get(0) == nil {
        return nil, args.Get(1).(*model.AppError)
    }
    return args.Get(0).(*model.RecapChannelResult), nil
}
```

### TypeScript Mocking

**Framework:** Jest built-in mocking

**Patterns:**
```typescript
// Module mock at file top
jest.mock('mattermost-redux/actions/recaps', () => ({
    createRecap: jest.fn(() => ({type: 'CREATE_RECAP'})),
}));

// Mock dispatch
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

// Component mock
jest.mock('./recap_menu', () => {
    return function RecapMenu({actions}: {actions: any[]}) {
        return <div data-testid='recap-menu'>{...}</div>;
    };
});

// Clear mocks in beforeEach
beforeEach(() => {
    jest.clearAllMocks();
});
```

**What to Mock:**
- External API calls (`Client4`)
- Redux dispatch
- Complex child components
- Router hooks (`useHistory`, `useRouteMatch`)
- Feature flags

**What NOT to Mock:**
- The component under test
- Simple presentational components
- Redux selectors (use `renderWithContext` with state)

## Fixtures and Factories

### Go Test Data

**Test Helper Pattern:**
```go
// Setup creates a test environment
th := Setup(t).InitBasic(t)

// Access test fixtures
th.BasicUser       // User fixture
th.BasicUser2      // Second user fixture
th.BasicTeam       // Team fixture
th.BasicChannel    // Channel fixture
th.Context         // Request context

// Create additional fixtures
channel := th.CreateChannel(t, th.BasicTeam)
privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
th.AddUserToChannel(t, th.BasicUser2, channel)
```

**Direct Model Creation:**
```go
recap := &model.Recap{
    Id:                model.NewId(),
    UserId:            th.BasicUser.Id,
    Title:             "Test Recap",
    CreateAt:          model.GetMillis(),
    UpdateAt:          model.GetMillis(),
    DeleteAt:          0,
    ReadAt:            0,
    TotalMessageCount: 10,
    Status:            model.RecapStatusCompleted,
    BotID:             "test-bot-id",
}
```

### TypeScript Test Data

**TestHelper Factory:**
```typescript
import {TestHelper} from 'utils/test_helper';

const mockChannel = TestHelper.getChannelMock({
    id: 'channel1',
    name: 'test-channel',
    display_name: 'Test Channel',
});

const mockUser = TestHelper.getUserMock({
    id: 'user1',
    username: 'testuser',
});
```

**State Fixtures:**
```typescript
const initialState = {
    entities: {
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: {id: 'user1', username: 'testuser'},
            },
        },
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: {id: 'team1', name: 'test-team'},
            },
        },
        channels: {
            channels: {
                channel1: mockChannel,
            },
            channelsInTeam: {
                team1: new Set(['channel1']),
            },
        },
    },
};
```

**Location:**
- `webapp/channels/src/utils/test_helper.ts` - Factory functions
- `webapp/channels/src/tests/` - Test utilities and setup

## Coverage

**Requirements:**
- No enforced minimum (coverage reports generated but not blocking)

**View Coverage:**
```bash
# Go coverage
cd server
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# TypeScript coverage
cd webapp/channels
npm run test-ci  # Generates coverage report
# Coverage report in webapp/channels/coverage/
```

**CI Reports:**
- Jest generates `test-results.xml` via `jest-junit`
- Coverage reporters: `json`, `lcov`, `text-summary`

## Test Types

### Unit Tests

**Go:**
- Test individual functions
- Mock dependencies
- Fast execution
- Examples: `TestExtractPostIDs`, `TestGeneratePassword`

```go
func TestExtractPostIDs(t *testing.T) {
    t.Run("extract post IDs from posts", func(t *testing.T) {
        posts := []*model.Post{
            {Id: "post1", Message: "test1"},
            {Id: "post2", Message: "test2"},
        }

        ids := extractPostIDs(posts)
        assert.Len(t, ids, 2)
        assert.Equal(t, "post1", ids[0])
    })
}
```

**TypeScript:**
- Test component rendering
- Test user interactions
- Test selectors/reducers

### Integration Tests

**Go:**
- Use `Setup(t).InitBasic(t)` for full app context
- Test API → App → Store flow
- Real database operations
- Examples: `TestCreateRecap`, `TestGetRecapsForUser`

**TypeScript:**
- Use `renderWithContext` with Redux store
- Test component + Redux integration
- Examples: `CreateRecapModal` tests

### Store Tests

**Location:** `server/channels/store/sqlstore/recap_store_test.go`

**Pattern:**
```go
func TestRecapStore(t *testing.T) {
    StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
        t.Run("SaveAndGetRecap", func(t *testing.T) {
            recap := &model.Recap{...}
            savedRecap, err := ss.Recap().SaveRecap(recap)
            require.NoError(t, err)
            // ...
        })
    })
}
```

### E2E Tests

**Framework:** Playwright (in `e2e-tests/` directory)
- Separate from unit/integration tests
- Test full user flows
- Not co-located with source

## Common Patterns

### Async Testing (TypeScript)

```typescript
test('should change selected bot when clicking', async () => {
    const user = userEvent.setup();
    renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

    // Wait for element
    await waitFor(() => {
        expect(screen.getByLabelText('Agent selector')).toHaveTextContent('Copilot');
    });

    // User interaction
    await user.click(screen.getByLabelText('Agent selector'));

    // Wait for element to disappear
    await waitForElementToBeRemoved(() => screen.queryByText('CHOOSE A BOT'));

    // Assert final state
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
});
```

### Error Testing (Go)

```go
t.Run("create recap with channel user is not member of", func(t *testing.T) {
    privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
    _ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)

    channelIds := []string{privateChannel.Id}
    ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

    recap, err := th.App.CreateRecap(ctx, "Test Recap", channelIds, "test-agent-id")

    require.NotNil(t, err)
    assert.Nil(t, recap)
    assert.Equal(t, "app.recap.permission_denied", err.Id)
})
```

### Error Testing (TypeScript)

```typescript
test('should not render when no highlights or action items', () => {
    const emptyChannel: RecapChannel = {
        ...mockRecapChannel,
        highlights: [],
        action_items: [],
    };

    const {container} = renderWithContext(
        <RecapChannelCard channel={emptyChannel}/>,
        baseState,
    );

    expect(container.firstChild).toBeNull();
});
```

### Table-Driven Tests (Go)

```go
func TestDoesNotifyPropsAllowPushNotification(t *testing.T) {
    tt := []struct {
        name                 string
        userNotifySetting    string
        channelNotifySetting string
        withSystemPost       bool
        wasMentioned         bool
        isMuted              bool
        expected             model.NotificationReason
    }{
        {
            name:              "When post is a System Message",
            userNotifySetting: model.UserNotifyAll,
            withSystemPost:    true,
            expected:          model.NotificationReasonSystemMessage,
        },
        // ... more cases
    }

    for _, tc := range tt {
        t.Run(tc.name, func(t *testing.T) {
            // Test logic using tc values
        })
    }
}
```

## Test Utilities

### renderWithContext (TypeScript)

```typescript
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

// Basic usage
renderWithContext(<Component prop={value}/>, initialState);

// With options
renderWithContext(<Component/>, initialState, {
    useMockedStore: true,  // Use mock store instead of real
    locale: 'en',
});

// Returns enhanced results
const {rerender, replaceStoreState, updateStoreState, store} = renderWithContext(...);

// Update store and rerender
replaceStoreState(newState);
updateStoreState(stateDiff);
```

### Setup Functions (Go)

```go
// Full integration test setup
th := Setup(t).InitBasic(t)

// Mock store setup
th := SetupWithStoreMock(t)
mockStore := th.App.Srv().Store().(*mocks.Store)

// Parallel test support
mainHelper.Parallel(t)
```

---

*Testing analysis: 2026-01-21*
