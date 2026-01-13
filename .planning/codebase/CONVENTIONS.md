# Coding Conventions

**Analysis Date:** 2026-01-13

## Naming Patterns

**Files:**
- Go: `snake_case.go` (e.g., `channel_actions.go`, `post_store.go`)
- TypeScript components: PascalCase directories (e.g., `about_build_modal/`)
- TypeScript utilities: `snake_case.ts` (e.g., `post_utils.ts`, `burn_on_read_timer_utils.ts`)
- Hooks: `camelCase` with "use" prefix (e.g., `useBurnOnReadTimer.ts`)
- Tests: `*_test.go` (Go), `*.test.ts(x)` (TypeScript) - co-located with source

**Functions:**
- Go: `PascalCase` for exported, `camelCase` for unexported
- TypeScript: `camelCase` (e.g., `openDirectChannelToUserId`, `isSystemMessage`)
- Event handlers: `handle*` prefix (e.g., `handleClick`, `handleSubmit`)

**Variables:**
- camelCase for variables (Go and TypeScript)
- UPPER_SNAKE_CASE for constants (e.g., `CHANNEL_SWITCH_IGNORE_ENTER_THRESHOLD_MS`)
- No underscore prefix for private members

**Types:**
- Go: `PascalCase` for exported types, structs
- TypeScript: `PascalCase` for interfaces, types, enums (e.g., `TimerState`, `SocketStatus`)
- No `I` prefix for interfaces (e.g., `User` not `IUser`)

## Code Style

**Formatting:**
- Go: `gofmt` standard (tabs)
- TypeScript: Prettier with `.prettierrc.json`
- Line length: 120 characters (TypeScript)
- Indentation: Tabs (Go), 4 spaces (TypeScript), 2 spaces (YAML/JSON)

**EditorConfig (`.editorconfig`):**
```
[*.{js,jsx,ts,tsx,html}] → 4 spaces
[*.go] → tabs
[*.{yml,yaml}] → 2 spaces
[*.scss] → 4 spaces
```

**Quotes and Semicolons (TypeScript):**
- Single quotes for strings (`singleQuote: true`)
- Semicolons: Required (ESLint enforced)
- No bracket spacing (`bracketSpacing: false`)

**Linting:**
- Go: `golangci-lint` with `.golangci.yml`
- TypeScript: ESLint with `.eslintrc.json`
- Run: `npm run lint` (webapp), `make lint` (server)

## Import Organization

**Go:**
1. Standard library
2. Third-party packages
3. Internal packages (`github.com/mattermost/mattermost/server/...`)

**TypeScript:**
1. External packages (react, redux, etc.)
2. Internal modules (@mattermost packages)
3. Relative imports (./utils, ../types)
4. Type imports last within groups

**Grouping:**
- Blank line between groups
- Alphabetical within each group

**Path Aliases (TypeScript):**
- `@mattermost/client` - API client SDK
- `@mattermost/types` - Shared types
- `@mattermost/components` - Shared UI components

## Error Handling

**Go Patterns:**
- Return `*model.AppError` for business errors
- Return Go `error` for system errors
- Always check returned errors
- Log with context before returning

```go
if err != nil {
    return nil, model.NewAppError("GetUser", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
}
```

**TypeScript Patterns:**
- Actions return `{data: ...}` or `{error: ...}`
- Use `try/catch` for async operations
- `bindClientFunc` for standardized Client4 error handling

```typescript
try {
    const data = await Client4.getUser(userId);
    return {data};
} catch (error) {
    forceLogoutIfNecessary(error);
    return {error};
}
```

## Logging

**Go Framework:**
- Package: `github.com/mattermost/logr/v2`
- Structured logging with context
- Levels: debug, info, warn, error

```go
mlog.Error("Failed to get user", mlog.String("user_id", userId), mlog.Err(err))
```

**TypeScript:**
- Console logging in development
- No `console.log` in production code (ESLint enforced)

## Comments

**When to Comment:**
- Explain "why" not "what"
- Document business rules and edge cases
- Complex algorithms or non-obvious logic

**Copyright Header (all files):**
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
```

**JSDoc/GoDoc:**
- Required for exported functions/types
- Use `@param`, `@returns`, `@throws` tags (TypeScript)
- Function documentation above declaration (Go)

**TODO Comments:**
- Format: `// TODO: description` or `// TODO: MM-XXXXX description`
- Link to Jira issue when applicable

## Function Design

**Size:**
- Keep functions focused, single responsibility
- Extract helpers for complex logic
- Go: Aim for <50 lines per function

**Parameters:**
- Go: Use context as first parameter when needed
- TypeScript: Max 3 parameters, use options object for more
- Destructure objects in parameter list

**Return Values:**
- Go: Return `(result, error)` tuple pattern
- TypeScript: Return `{data}` or `{error}` from async actions
- Return early for guard clauses

## Module Design

**Go Exports:**
- PascalCase for exported identifiers
- Package-level functions for module API
- Internal helpers in same file or `internal/` package

**TypeScript Exports:**
- Named exports preferred
- Default exports for React components
- Barrel files (`index.ts`) for public API

**React Component Patterns:**
- Functional components (no class components in new code)
- Hooks: `useSelector`, `useDispatch`, `useCallback`, `useMemo`
- `React.memo` for expensive render logic
- `makeAsyncComponent` for code splitting

## CSS/SCSS Conventions

**Co-location:**
- SCSS file next to component (e.g., `my_component.scss` + `my_component.tsx`)
- Import styles directly into component

**Naming:**
- Root class: PascalCase matching component (e.g., `.MyComponent`)
- Child elements: BEM suffix (e.g., `.MyComponent__title`)
- Modifiers: Separate class (e.g., `&.compact`)

**Theming:**
- Use CSS variables for colors: `var(--link-color)`
- RGB variants for transparency: `rgba(var(--link-color-rgb), 0.8)`
- Theme variables in `channels/src/sass/base/_css_variables.scss`

**Avoid:**
- `!important` (over 300 legacy instances need cleanup)
- Hard-coded color values in themed areas
- Element selectors (prefer class selectors)

## Redux Patterns

**Actions:**
- Async thunks return `{data}` or `{error}`
- Use `Client4` only in Redux actions
- Batch network requests when possible

**Selectors:**
- Memoize with `createSelector` for computed values
- Factory pattern (`makeGet*`) for parameterized selectors
- Use `useMemo` for selector instances in functional components

**Error Handling:**
- Wrap `Client4` calls in try/catch
- Call `forceLogoutIfNecessary` on errors
- Dispatch `logError` for error tracking

## Accessibility

**Semantic HTML:**
- Use `button`, `input`, `h2`, `ul` over `div`/`span`
- Interactive elements must have accessible names
- Use `aria-labelledby` or `aria-label`

**Keyboard Support:**
- All interactive elements focusable
- Standard keyboard patterns (Enter, Space, Arrow keys)
- Visible focus states (`.a11y--focused` class)

**Screen Readers:**
- Alt text for images (don't include "image" or "icon")
- `aria-expanded` for expandable elements
- `aria-describedby` for additional context

## Internationalization

**React Intl:**
- Use `FormattedMessage` over `useIntl` when possible
- Store `MessageDescriptor` objects outside React
- Don't use deprecated `localizeMessage`

**Formatting:**
- Rich text formatting for mixed styles
- Never concatenate translated strings

---

*Convention analysis: 2026-01-13*
*Update when patterns change*
