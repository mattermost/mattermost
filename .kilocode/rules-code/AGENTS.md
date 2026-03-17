# AGENTS.md - Code Mode

This file provides coding-specific guidance for agents working in Code mode in this repository.

## Go Code Rules

### Required Copyright Header
Every Go file must include this exact header at the top:
```go
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
```

### Import Organization
Import order must be:
1. Standard library
2. External packages
3. Internal Mattermost packages

Example:
```go
import (
    "context"
    "time"

    "github.com/gorilla/mux"
    "github.com/sirupsen/logrus"

    "github.com/mattermost/mattermost/server/v8/model"
    "github.com/mattermost/mattermost/server/v8/channels/app"
)
```

### Store Layer Pattern
- Use `store.New` to get store instance
- Generated store mocks are in `channels/store/storetest/mocks/`
- Never write raw SQL queries in app layer - use store methods
- Migrations must use morph tool: `make new-migration name=<name>`

### Build Tags for Enterprise
Enterprise code uses build tags:
```go
//go:build enterprise
package something
```

### Mock Generation
- Run `make store-mocks` after modifying store interfaces
- Run `make telemetry-mocks` after modifying telemetry interfaces
- Run `make plugin-mocks` after modifying plugin API
- Uses mockery v2.42.2 (auto-installed by make)

## TypeScript/React Rules

### Indentation
- 4 spaces for all JS/TS/TSX files
- 2 spaces only for `package.json`, `.eslintrc.json`, i18n files

### ESLint
- Uses custom `@mattermost/eslint-plugin` from `webapp/platform/eslint-plugin`
- Run `npm run check` in webapp/channels/
- Run `npm run fix` to auto-fix issues

### Import Patterns
- Use named imports: `import { useSelector } from 'react-redux'`
- Avoid default exports for components

### Testing
- Jest tests run with `TZ=Etc/UTC` (set automatically)
- Use `@testing-library/react` for new tests
- Legacy tests use Enzyme

### i18n Strings
- Use `formatMessage` or `FormattedMessage` from react-intl
- Extract with: `npm run i18n-extract` (in webapp/channels/)
- String IDs use PascalCase: `admin.teamSettings.teamName`

## Common Coding Tasks

### Adding a New API Endpoint
1. Define in `server/channels/api4/` (e.g., `teams.go`)
2. Add route in same file's `Init` function
3. Follow existing handler patterns with permission checks
4. Add tests in `*_test.go` file

### Adding a New Database Migration
```bash
cd server/
make new-migration name=add_column_x
# This creates BOTH mysql and postgres migrations
```

### Generating Store Mocks
```bash
cd server/
make store-mocks
```

### Working with Webapp Workspaces
```bash
cd webapp/
npm install  # Builds all workspaces automatically via postinstall
# Workspaces: channels/, platform/client, platform/components, platform/types
```
