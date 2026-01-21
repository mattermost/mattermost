# Coding Conventions

**Analysis Date:** 2026-01-21

## Naming Patterns

**Files:**
- **Go (Server):** `snake_case.go` for source files, `snake_case_test.go` for tests
  - Examples: `recap.go`, `recap_test.go`, `recap_store.go`
- **TypeScript (Frontend):** `snake_case.tsx` for components, `snake_case.test.tsx` for tests
  - Examples: `recap_channel_card.tsx`, `recap_channel_card.test.tsx`
- **Index files:** `index.ts` for barrel exports

**Functions:**
- **Go:** `PascalCase` for exported, `camelCase` for unexported
  - Examples: `CreateRecap`, `GetRecapsForUser`, `fetchPostsForRecap`, `extractPostIDs`
- **TypeScript:** `camelCase` for functions and hooks
  - Examples: `handleChannelClick`, `parsePermalink`, `useGetFeatureFlagValue`
- **React Components:** `PascalCase`
  - Examples: `RecapChannelCard`, `RecapsList`, `CreateRecapModal`

**Variables:**
- **Go:** `camelCase` for local variables
  - Examples: `recapID`, `channelIDs`, `userID`, `savedRecap`
- **TypeScript:** `camelCase` for local variables and state
  - Examples: `isCollapsed`, `activeTab`, `displayedRecaps`

**Types/Interfaces:**
- **Go:** `PascalCase` for structs and types
  - Examples: `Recap`, `RecapChannel`, `RecapChannelResult`
- **TypeScript:** `PascalCase` for types/interfaces
  - Examples: `Props`, `ParsedItem`, `RecapMenuAction`

**Constants:**
- **Go:** `PascalCase` for exported constants, grouped in `const` blocks
  - Examples: `RecapStatusPending`, `RecapStatusCompleted`
- **TypeScript:** `PascalCase` for enum values, `SCREAMING_SNAKE_CASE` for action types
  - Examples: `RecapStatus.COMPLETED`, `RecapTypes.CREATE_RECAP_REQUEST`

## Code Style

**Formatting:**
- **Go:** `gofmt` with `goimports` (configured in `.golangci.yml`)
  - `interface{}` replaced with `any`
- **TypeScript:** ESLint with `@mattermost/eslint-plugin-react`
  - Config: `webapp/channels/.eslintrc.json`

**Linting:**
- **Go:** `golangci-lint` with these enabled linters:
  - `errcheck`, `govet`, `staticcheck`, `revive`, `misspell`, `unconvert`, `unused`
  - Config: `server/.golangci.yml`
- **TypeScript:** ESLint with formatjs plugin for i18n
  - Rules enforced: `formatjs/enforce-default-message`, `formatjs/enforce-id`
  - `no-only-tests/no-only-tests` prevents committed `.only` tests

**Stylelint:**
- Config: `webapp/channels/.stylelintrc.json`
- Enforces SCSS/CSS consistency

## Import Organization

**Go Order:**
1. Standard library imports
2. External dependencies (github.com/*)
3. Internal Mattermost packages (github.com/mattermost/*)

**TypeScript Order:**
1. React and core libraries (`react`, `react-intl`, `react-redux`)
2. Third-party libraries (`@mattermost/compass-icons/*`)
3. Type imports (`type { RecapChannel }`)
4. Internal mattermost-redux imports
5. Internal action imports
6. Component imports
7. Local imports (`./recap_menu`, `./recap_text_formatter`)
8. Style imports (`./recaps.scss`)

**Path Aliases:**
- `mattermost-redux/*` → `src/packages/mattermost-redux/src/*`
- `@mattermost/types/*` → `webapp/platform/types/src/*`
- `@mattermost/client` → `webapp/platform/client/src`
- `tests/*` → `src/tests/*`
- `actions/*` → `src/actions/*`
- `components/*` → `src/components/*`

## Error Handling

**Go Patterns:**
- Return `*model.AppError` for app layer errors
- Wrap store errors with descriptive messages using `errors.Wrap()`
- Use standardized error IDs: `app.recap.{operation}.app_error`

```go
// App layer pattern
func (a *App) GetRecap(rctx request.CTX, recapID string) (*model.Recap, *model.AppError) {
    recap, err := a.Srv().Store().Recap().GetRecap(recapID)
    if err != nil {
        return nil, model.NewAppError("GetRecap", "app.recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
    }
    return recap, nil
}

// Store layer pattern
if err := s.GetReplica().GetBuilder(&recap, query); err != nil {
    if err == sql.ErrNoRows {
        return nil, store.NewErrNotFound("Recap", id)
    }
    return nil, errors.Wrapf(err, "failed to get Recap with id=%s", id)
}
```

**TypeScript Patterns:**
- Redux actions use `try/catch` with `forceLogoutIfNecessary` for auth errors
- Use `logError` action for error logging
- Return `{error}` or `{data}` objects from async actions

```typescript
export function deleteRecap(recapId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteRecap(recapId);
            dispatch({type: RecapTypes.DELETE_RECAP_SUCCESS, data: {recapId}});
            return {data: true};
        } catch (error) {
            dispatch(logError(error));
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
    };
}
```

## Logging

**Go Framework:** `mlog` (Mattermost logging)

**Patterns:**
```go
// Structured logging with fields
logger.Info("Starting recap job",
    mlog.String("recap_id", recapID),
    mlog.String("agent_id", agentID),
    mlog.Int("channel_count", len(channelIDs)))

// Warning with error
logger.Warn("Failed to process channel",
    mlog.String("channel_id", channelID),
    mlog.Err(err))

// Error logging
logger.Error("Failed to update recap", mlog.Err(err))
```

**TypeScript Framework:** `console` for tests, custom logging for production

## Comments

**When to Comment:**
- Copyright header at top of every file (required)
- Complex business logic
- Non-obvious algorithms
- Public API functions (Go)

**Copyright Header (Required):**
```go
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
```

**JSDoc/TSDoc:**
- Not heavily used; code is self-documenting
- Type annotations provide documentation

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Extract helper functions for complex logic
- Go functions typically 10-50 lines

**Parameters:**
- Use context (`request.CTX`) as first parameter in Go app functions
- Use props objects for React components
- Destructure props in function signature

```typescript
// React component pattern
const RecapChannelCard = ({channel}: Props) => {
```

**Return Values:**
- **Go:** Return `(value, error)` tuple pattern
- **TypeScript:** Return action result objects `{data}` or `{error}`

## Module Design

**Exports:**
- Use barrel files (`index.ts`) for public API
- Default export for React components
- Named exports for utilities and selectors

```typescript
// index.ts barrel export
export {default} from './recaps';
```

**React Component Pattern:**
```typescript
// Functional component with hooks
const Recaps = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    // ...hooks for state and effects
    return (...);
};

export default Recaps;
```

## i18n (Internationalization)

**React Pattern:**
```typescript
// Use react-intl hooks
const {formatMessage} = useIntl();

// FormattedMessage for JSX
<FormattedMessage
    id='recaps.highlights'
    defaultMessage='Highlights'
/>

// formatMessage for strings
formatMessage({
    id: 'recaps.menu.markChannelRead',
    defaultMessage: 'Mark this channel as read',
})
```

**Rules:**
- Every user-facing string must have an `id` and `defaultMessage`
- Use `formatjs/enforce-id` ESLint rule
- i18n keys follow pattern: `{component}.{element}`

## Redux Patterns

**Action Types:**
```typescript
// Action type constants in action_types/recaps.ts
export const RecapTypes = {
    CREATE_RECAP_REQUEST: 'CREATE_RECAP_REQUEST',
    CREATE_RECAP_SUCCESS: 'CREATE_RECAP_SUCCESS',
    // ...
};
```

**Selectors:**
```typescript
// Use createSelector for memoized selectors
export const getUnreadRecaps = createSelector(
    'getUnreadRecaps',
    getAllRecaps,
    (recaps) => recaps.filter((recap) => recap.read_at === 0)
);
```

**Actions:**
```typescript
// Use bindClientFunc helper for simple CRUD
export function getRecaps(page = 0, perPage = 60): ActionFuncAsync<Recap[]> {
    return bindClientFunc({
        clientFunc: () => Client4.getRecaps(page, perPage),
        onRequest: RecapTypes.GET_RECAPS_REQUEST,
        onSuccess: [RecapTypes.GET_RECAPS_SUCCESS, RecapTypes.RECEIVED_RECAPS],
        onFailure: RecapTypes.GET_RECAPS_FAILURE,
    });
}
```

## API Layer Patterns (Go)

**Handler Structure:**
```go
func getRecap(c *Context, w http.ResponseWriter, r *http.Request) {
    // 1. Feature flag check
    requireRecapsEnabled(c)
    if c.Err != nil {
        return
    }

    // 2. Parameter validation
    c.RequireRecapId()
    if c.Err != nil {
        return
    }

    // 3. Audit record setup
    auditRec := c.MakeAuditRecord(model.AuditEventGetRecap, model.AuditStatusFail)
    defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

    // 4. Business logic
    recap, err := c.App.GetRecap(c.AppContext, c.Params.RecapId)
    if err != nil {
        c.Err = err
        return
    }

    // 5. Authorization check
    if recap.UserId != c.AppContext.Session().UserId {
        c.Err = model.NewAppError("getRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
        return
    }

    // 6. Success response
    auditRec.Success()
    json.NewEncoder(w).Encode(recap)
}
```

## Store Layer Patterns (Go)

**Query Builder:**
```go
// Use squirrel for SQL building
query := s.getQueryBuilder().
    Select(recapColumns...).
    From("Recaps").
    Where(sq.Eq{"UserId": userId, "DeleteAt": 0}).
    OrderBy("CreateAt DESC").
    Limit(uint64(perPage))
```

**Soft Deletes:**
- Use `DeleteAt` timestamp field
- Filter by `DeleteAt: 0` for active records

---

*Convention analysis: 2026-01-21*
