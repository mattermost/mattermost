# Skeleton File Generation Examples

## Overview

This document provides examples of skeleton files generated in Stage 2 of the main workflow, before Zephyr creation and code generation.

## Example 1: Authentication Test

### Input (from Test Plan)

```markdown
### Scenario 1: Test successful login
**Objective**: Verify user can login with valid credentials
**Test Steps**:
1. Navigate to login page
2. Enter valid username and password
3. Click Login button
4. Verify user is redirected to dashboard
```

### Generated Skeleton File

**File Path**: `e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can login with valid credentials
 * @test steps
 *  1. Navigate to login page
 *  2. Enter valid username and password
 *  3. Click Login button
 *  4. Verify user is redirected to dashboard
 */
test('MM-TXXX Test successful login', {tag: '@auth'}, async ({pw}) => {
    // TODO: Implementation will be generated after Zephyr test case creation
});
```

### Metadata JSON

```json
{
  "filePath": "e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts",
  "placeholder": "MM-TXXX",
  "testName": "Test successful login",
  "objective": "Verify user can login with valid credentials",
  "steps": [
    "Navigate to login page",
    "Enter valid username and password",
    "Click Login button",
    "Verify user is redirected to dashboard"
  ],
  "category": "auth"
}
```

## Example 2: Channel Management Test

### Input (from Test Plan)

```markdown
### Scenario 1: Create public channel
**Objective**: Verify user can create a public channel
**Test Steps**:
1. Navigate to channels page
2. Click "Create Channel" button
3. Enter channel name and description
4. Select "Public" option
5. Click "Create" button
6. Verify channel appears in sidebar
```

### Generated Skeleton File

**File Path**: `e2e-tests/playwright/specs/functional/channels/create_public_channel.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can create a public channel
 * @test steps
 *  1. Navigate to channels page
 *  2. Click "Create Channel" button
 *  3. Enter channel name and description
 *  4. Select "Public" option
 *  5. Click "Create" button
 *  6. Verify channel appears in sidebar
 */
test('MM-TXXX Create public channel', {tag: '@channels'}, async ({pw}) => {
    // TODO: Implementation will be generated after Zephyr test case creation
});
```

### Metadata JSON

```json
{
  "filePath": "e2e-tests/playwright/specs/functional/channels/create_public_channel.spec.ts",
  "placeholder": "MM-TXXX",
  "testName": "Create public channel",
  "objective": "Verify user can create a public channel",
  "steps": [
    "Navigate to channels page",
    "Click \"Create Channel\" button",
    "Enter channel name and description",
    "Select \"Public\" option",
    "Click \"Create\" button",
    "Verify channel appears in sidebar"
  ],
  "category": "channels"
}
```

## Example 3: Messaging Test

### Input (from Test Plan)

```markdown
### Scenario 1: Post message in thread
**Objective**: Verify user can reply to a message in a thread
**Test Steps**:
1. Navigate to a channel with existing messages
2. Hover over a message
3. Click "Reply" button
4. Enter reply text
5. Click "Send" button
6. Verify reply appears in thread
```

### Generated Skeleton File

**File Path**: `e2e-tests/playwright/specs/functional/messaging/post_message_in_thread.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can reply to a message in a thread
 * @test steps
 *  1. Navigate to a channel with existing messages
 *  2. Hover over a message
 *  3. Click "Reply" button
 *  4. Enter reply text
 *  5. Click "Send" button
 *  6. Verify reply appears in thread
 */
test('MM-TXXX Post message in thread', {tag: '@messaging'}, async ({pw}) => {
    // TODO: Implementation will be generated after Zephyr test case creation
});
```

### Metadata JSON

```json
{
  "filePath": "e2e-tests/playwright/specs/functional/messaging/post_message_in_thread.spec.ts",
  "placeholder": "MM-TXXX",
  "testName": "Post message in thread",
  "objective": "Verify user can reply to a message in a thread",
  "steps": [
    "Navigate to a channel with existing messages",
    "Hover over a message",
    "Click \"Reply\" button",
    "Enter reply text",
    "Click \"Send\" button",
    "Verify reply appears in thread"
  ],
  "category": "messaging"
}
```

## Example 4: System Console Test

### Input (from Test Plan)

```markdown
### Scenario 1: Search users by email in system console
**Objective**: Verify admin can search users by email address
**Test Steps**:
1. Login as admin user
2. Navigate to System Console
3. Go to Users section
4. Enter user email in search field
5. Verify matching user appears in results
```

### Generated Skeleton File

**File Path**: `e2e-tests/playwright/specs/functional/system_console/search_users_by_email.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify admin can search users by email address
 * @test steps
 *  1. Login as admin user
 *  2. Navigate to System Console
 *  3. Go to Users section
 *  4. Enter user email in search field
 *  5. Verify matching user appears in results
 */
test('MM-TXXX Search users by email in system console', {tag: '@system_console'}, async ({pw}) => {
    // TODO: Implementation will be generated after Zephyr test case creation
});
```

### Metadata JSON

```json
{
  "filePath": "e2e-tests/playwright/specs/functional/system_console/search_users_by_email.spec.ts",
  "placeholder": "MM-TXXX",
  "testName": "Search users by email in system console",
  "objective": "Verify admin can search users by email address",
  "steps": [
    "Login as admin user",
    "Navigate to System Console",
    "Go to Users section",
    "Enter user email in search field",
    "Verify matching user appears in results"
  ],
  "category": "system_console"
}
```

## Key Characteristics of Skeleton Files

### 1. Complete Documentation
- ✅ Full JSDoc with `@objective` and `@test steps`
- ✅ Detailed step-by-step instructions
- ✅ Clear test intent

### 2. Placeholder Test Key
- ✅ Uses "MM-TXXX" in test title
- ✅ Will be replaced with actual Zephyr key later
- ✅ Easy to identify and replace

### 3. Empty Test Body
- ✅ Contains only TODO comment
- ✅ No automation code yet
- ✅ Prevents incomplete implementations

### 4. Proper Structure
- ✅ Correct import statements
- ✅ Proper test syntax with tag
- ✅ Uses `pw` fixture (Mattermost pattern)

### 5. Correct File Placement
- ✅ In appropriate subdirectory based on category
- ✅ Follows naming conventions (lowercase, underscores)
- ✅ Uses `.spec.ts` extension

## After Placeholder Replacement

Once Zephyr test cases are created and keys are assigned, the files are updated:

**Before**:
```typescript
test('MM-TXXX Test successful login', {tag: '@auth'}, async ({pw}) => {
```

**After**:
```typescript
test('MM-T1234 Test successful login', {tag: '@auth'}, async ({pw}) => {
```

## Category Inference Logic

The skeleton generator automatically infers the category from test names:

| Keywords in Test Name | Inferred Category | Directory |
|-----------------------|-------------------|-----------|
| login, auth, authentication, logout, password | `auth` | `specs/functional/auth/` |
| channel, sidebar, team | `channels` | `specs/functional/channels/` |
| message, post, thread, reply | `messaging` | `specs/functional/messaging/` |
| system console, admin, setting | `system_console` | `specs/functional/system_console/` |
| playbook, run, checklist | `playbooks` | `specs/functional/playbooks/` |
| call, voice, video, screen share | `calls` | `specs/functional/channels/calls/` |
| (default) | `functional` | `specs/functional/` |

## File Naming Conventions

### Pattern
```
{feature_description}.spec.ts
```

### Transformation Rules
1. Convert to lowercase
2. Remove special characters (except spaces)
3. Replace spaces with underscores
4. Remove "test_" prefix if present
5. Add `.spec.ts` extension

### Examples

| Test Name | Generated File Name |
|-----------|---------------------|
| Test successful login | `successful_login.spec.ts` |
| Create public channel | `create_public_channel.spec.ts` |
| Post message in thread | `post_message_in_thread.spec.ts` |
| Search users by email | `search_users_by_email.spec.ts` |
| User can @mention teammates | `user_can_mention_teammates.spec.ts` |

## Multiple Scenarios in One Workflow

When multiple scenarios are provided, separate skeleton files are generated:

### Input
```markdown
## Test Plan: Authentication

### Scenario 1: Test successful login
...

### Scenario 2: Test unsuccessful login with invalid credentials
...

### Scenario 3: Test password reset flow
...
```

### Generated Files
```
e2e-tests/playwright/specs/functional/auth/
├── successful_login.spec.ts
├── unsuccessful_login_with_invalid_credentials.spec.ts
└── password_reset_flow.spec.ts
```

### Generated Metadata Array
```json
[
  {
    "filePath": "e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts",
    "placeholder": "MM-TXXX",
    "testName": "Test successful login",
    ...
  },
  {
    "filePath": "e2e-tests/playwright/specs/functional/auth/unsuccessful_login_with_invalid_credentials.spec.ts",
    "placeholder": "MM-TXXX",
    "testName": "Test unsuccessful login with invalid credentials",
    ...
  },
  {
    "filePath": "e2e-tests/playwright/specs/functional/auth/password_reset_flow.spec.ts",
    "placeholder": "MM-TXXX",
    "testName": "Test password reset flow",
    ...
  }
]
```

## Validation

Before proceeding to Stage 3, the skeleton generator validates:

- ✅ All files created successfully
- ✅ Files contain valid TypeScript syntax
- ✅ Each file has complete JSDoc
- ✅ Placeholder "MM-TXXX" present in each test title
- ✅ Test body is empty (contains only TODO)
- ✅ Metadata captured for all files

## User Confirmation Prompt

After generation, user sees:

```
Generated 3 skeleton files:
1. e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
2. e2e-tests/playwright/specs/functional/auth/unsuccessful_login_with_invalid_credentials.spec.ts
3. e2e-tests/playwright/specs/functional/auth/password_reset_flow.spec.ts

Should I create Zephyr Test Cases for these scenarios now? (yes/no)
```

If user confirms, workflow proceeds to Stage 3 (Zephyr Sync).
