# Main Workflow: 3-Stage Pipeline

## Overview

This workflow creates new E2E tests from scratch, syncs them with Zephyr test management, and generates full Playwright automation code.

## Trigger

User requests to create new E2E tests for a feature:
- "Create tests for login feature"
- "Generate E2E tests for channel creation"
- "I need tests for the messaging functionality"

## Workflow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Stage 1: PLANNING                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Planner Agent (existing)                                  │  │
│  │  - Analyzes feature                                        │  │
│  │  - Identifies test scenarios (1-3 focused tests)           │  │
│  │  - Creates test plan with objectives & steps               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                     │
│                    Test Plan Markdown                             │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                   Stage 2: SKELETON GENERATION                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Skeleton Generator Agent (new)                            │  │
│  │  - Creates .spec.ts files (one per scenario)               │  │
│  │  - Includes JSDoc (@objective, @test steps)                │  │
│  │  - Uses "MM-TXXX" placeholder in test title                │  │
│  │  - Leaves test body empty                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                     │
│            Skeleton Files + Metadata JSON                         │
│                             ↓                                     │
│              ┌──────────────────────────┐                         │
│              │  Ask User Confirmation   │                         │
│              │  "Create Zephyr cases?"  │                         │
│              └──────────────────────────┘                         │
│                      Yes ↓      No ↓                              │
└──────────────────────────────────────────────────────────────────┘
                           ↓         ↓
                           ↓    (Exit: Files remain with MM-TXXX)
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│                Stage 3: ZEPHYR SYNC + CODE GENERATION             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Zephyr Sync Agent (new)                                   │  │
│  │                                                             │  │
│  │  Step 3A: Create Test Cases in Zephyr                      │  │
│  │    - Batch create via Zephyr API                           │  │
│  │    - Receive actual test keys (MM-T1234, MM-T1235, etc.)   │  │
│  │                                                             │  │
│  │  Step 3B: Replace Placeholders                             │  │
│  │    - Find all "MM-TXXX" in files                           │  │
│  │    - Replace with actual Zephyr keys                       │  │
│  │                                                             │  │
│  │  Step 3C: Generate Full Playwright Code                    │  │
│  │    - Invoke existing Generator Agent                       │  │
│  │    - Produce complete test implementation                  │  │
│  │                                                             │  │
│  │  Step 3D: Update Files                                     │  │
│  │    - Overwrite skeleton files with full code               │  │
│  │                                                             │  │
│  │  Step 3E: (Optional) Execute Tests                         │  │
│  │    - Run tests locally                                     │  │
│  │    - Verify they pass                                      │  │
│  │                                                             │  │
│  │  Step 3F: Update Zephyr Metadata                           │  │
│  │    - Mark as "Automated"                                   │  │
│  │    - Add file path                                         │  │
│  │    - Add timestamp                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                     │
│        Complete .spec.ts Files + Synced Zephyr Cases              │
└──────────────────────────────────────────────────────────────────┘
```

## Stage 1: Planning

### Agent: Planner Agent (existing)

**Input**: Feature description or user story

**Process**:
1. Analyzes the feature requirements
2. Identifies 1-3 focused test scenarios (core business logic)
3. Creates test plan with:
   - Scenario name
   - Test objective
   - Test steps (3-6 steps per scenario)

**Output**: Test plan in markdown format

**Example**:
```markdown
## Test Plan: Login Feature

### Scenario 1: Test successful login
**Objective**: Verify user can login with valid credentials
**Test Steps**:
1. Navigate to login page
2. Enter valid username and password
3. Click Login button
4. Verify user is redirected to dashboard

### Scenario 2: Test unsuccessful login
**Objective**: Verify appropriate error shown for invalid credentials
**Test Steps**:
1. Navigate to login page
2. Enter invalid username and password
3. Click Login button
4. Verify error message is displayed
```

## Stage 2: Skeleton Generation

### Agent: Skeleton Generator Agent

**Input**: Test plan from Stage 1

**Process**:
1. Parses test plan markdown
2. For each scenario:
   - Infers category (auth, channels, messaging, etc.)
   - Generates file name from scenario name
   - Creates `.spec.ts` file with:
     - Import statements
     - JSDoc with @objective and @test steps
     - Test title with "MM-TXXX" placeholder
     - Empty test body with TODO comment
3. Stores metadata for each file
4. Prompts user for confirmation

**Output**:
- Skeleton `.spec.ts` files
- Metadata JSON with file paths and test details
- User confirmation prompt

**Example Output**:

File: `e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts`
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

### User Confirmation

After skeleton generation, the agent asks:

```
Generated 2 skeleton files:
1. e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
2. e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts

Should I create Zephyr Test Cases for these scenarios now? (yes/no)
```

**If NO**: Workflow stops. Files remain with MM-TXXX placeholders for manual handling.

**If YES**: Proceed to Stage 3.

## Stage 3: Zephyr Sync + Code Generation

### Agent: Zephyr Sync Agent

**Input**: Skeleton file metadata from Stage 2

### Step 3A: Create Test Cases in Zephyr

**Process**:
1. Load Zephyr configuration from `.claude/settings.local.json`
2. For each skeleton file:
   - Build Zephyr API payload with:
     - Test name
     - Objective
     - Test steps
     - Labels (automated, e2e, category)
     - Custom fields (Automation Status: "In Progress")
   - Call Zephyr API to create test case
   - Receive response with test key (MM-T1234)
3. Build mapping: file path → Zephyr test key

**Example API Call**:
```bash
POST /rest/atm/1.0/testcase
{
  "projectKey": "MM",
  "name": "Test successful login",
  "objective": "Verify user can login with valid credentials",
  "labels": ["automated", "e2e", "auth"],
  "testScript": {
    "type": "STEP_BY_STEP",
    "steps": [...]
  }
}

Response:
{
  "key": "MM-T1234",
  "id": 12345,
  "name": "Test successful login"
}
```

### Step 3B: Replace Placeholders

**Process**:
1. For each file, create mapping:
   ```json
   {
     "placeholder": "MM-TXXX",
     "actualKey": "MM-T1234",
     "filePath": "specs/functional/auth/successful_login.spec.ts"
   }
   ```
2. Use placeholder-replacer tool to update files
3. Verify no "MM-TXXX" remains in codebase

**Before**:
```typescript
test('MM-TXXX Test successful login', {tag: '@auth'}, async ({pw}) => {
```

**After**:
```typescript
test('MM-T1234 Test successful login', {tag: '@auth'}, async ({pw}) => {
```

### Step 3C: Generate Full Playwright Code

**Process**:
1. For each test scenario:
   - Prepare code generation request with:
     - Zephyr test key (MM-T1234)
     - Test name
     - Objective
     - Test steps
     - Category
   - Invoke existing Generator Agent
   - Receive complete Playwright implementation

**Example Generated Code**:
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
test('MM-T1234 Test successful login', {tag: '@auth'}, async ({pw}) => {
    const {user} = await pw.initSetup();

    // # Navigate to login page
    const {loginPage} = await pw.testBrowser.openLoginPage();

    // # Enter valid credentials
    await loginPage.fillCredentials(user.username, user.password);

    // # Click Login button
    await loginPage.clickLoginButton();

    // * Verify user is redirected to dashboard
    await expect(pw.page).toHaveURL(/.*\/channels\/.*/);
    await expect(pw.page.locator('[data-testid="sidebar-header"]')).toBeVisible();
});
```

### Step 3D: Update Files

**Process**:
1. For each file:
   - Read generated code from Step 3C
   - Overwrite skeleton file with complete implementation
   - Preserve file path

### Step 3E: (Optional) Execute Tests

**Process**:
1. For each test file:
   - Run: `npx playwright test <file-path> --project=chrome`
   - Capture stdout/stderr
   - Determine pass/fail status
2. Log results
3. If failures occur, optionally invoke Healer Agent

**Note**: Test execution failures don't block the workflow. Files are created successfully regardless.

### Step 3F: Update Zephyr Metadata

**Process**:
1. For each test case:
   - Build update payload:
     ```json
     {
       "status": "Approved",
       "customFields": {
         "Automation Status": "Automated",
         "Automation File": "specs/functional/auth/successful_login.spec.ts",
         "Last Automated": "2025-01-15T10:30:00Z"
       }
     }
     ```
   - Call Zephyr API to update test case
2. Log update status

**Example API Call**:
```bash
PUT /rest/atm/1.0/testcase/MM-T1234
{
  "status": "Approved",
  "customFields": {
    "Automation Status": "Automated",
    "Automation File": "specs/functional/auth/successful_login.spec.ts",
    "Last Automated": "2025-01-15T10:30:00Z"
  }
}
```

## Complete Output Example

```
=== Starting 3-Stage Pipeline ===

Stage 1: Creating test plan...
✓ Test plan created with 2 scenarios

Stage 2: Generating skeleton files...
✓ Created: e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
✓ Created: e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts

Should I create Zephyr Test Cases for these scenarios now? yes

Stage 3: Syncing with Zephyr and generating code...

Step 3A: Creating test cases in Zephyr...
✓ Created: MM-T1234 - Test successful login
✓ Created: MM-T1235 - Test unsuccessful login

Step 3B: Replacing placeholders...
✓ Replaced MM-TXXX → MM-T1234 in successful_login.spec.ts
✓ Replaced MM-TXXX → MM-T1235 in unsuccessful_login.spec.ts

Step 3C: Generating full Playwright code...
✓ Generated: MM-T1234
✓ Generated: MM-T1235

Step 3D: Updating files...
✓ Updated: successful_login.spec.ts
✓ Updated: unsuccessful_login.spec.ts

Step 3E: Executing tests...
✓ Test passed: MM-T1234
✓ Test passed: MM-T1235

Step 3F: Updating Zephyr metadata...
✓ Updated: MM-T1234
✓ Updated: MM-T1235

=== Pipeline Complete ===

Summary:
  MM-T1234: specs/functional/auth/successful_login.spec.ts (PASSED)
  MM-T1235: specs/functional/auth/unsuccessful_login.spec.ts (PASSED)
```

## Error Handling

### Stage 1 Errors
- **Invalid feature description**: Ask user for clarification
- **Cannot create test plan**: Report error and exit

### Stage 2 Errors
- **File already exists**: Option to skip or append timestamp
- **Invalid file path**: Fallback to default location

### Stage 3 Errors
- **Zephyr API failure**: Retry with exponential backoff (3 attempts)
- **Placeholder replacement fails**: Rollback and report
- **Code generation fails**: Report error for specific test, continue with others
- **Test execution fails**: Log failure but continue (don't block)
- **Zephyr update fails**: Warn but consider operation successful

## Configuration Requirements

### `.claude/settings.local.json`

```json
{
  "zephyr": {
    "baseUrl": "https://mattermost.atlassian.net",
    "jiraToken": "YOUR_JIRA_PAT",
    "zephyrToken": "YOUR_ZEPHYR_TOKEN",
    "projectKey": "MM",
    "folderId": "12345"
  }
}
```

## Integration with Existing Skill

This workflow extends the existing `e2e-test-creation` skill without modifying it:

### Reused Components
- ✅ Planner Agent (Stage 1)
- ✅ Generator Agent (Stage 3C)
- ✅ Healer Agent (optional, if test fails)

### New Components
- 🆕 Skeleton Generator Agent (Stage 2)
- 🆕 Zephyr Sync Agent (Stage 3)
- 🆕 Zephyr API Tool
- 🆕 Placeholder Replacer Tool

### No Breaking Changes
- Existing workflows continue to work
- New workflow triggered by user confirmation prompt
- Both workflows can coexist

## Usage Examples

### Example 1: Basic Usage

```
User: Create tests for the login feature