# Main Workflow: Strict 10-Step Pipeline with Mandatory Zephyr

## ⚠️ CRITICAL WARNING

**BEFORE USING THIS WORKFLOW, READ:**
- **[STRICT-WORKFLOW.md](STRICT-WORKFLOW.md)** - Contains critical rules and common mistakes
- Violating these rules will break Zephyr integration and waste time/cost

**Most common violations:**
1. ❌ Using fake MM-T numbers (MM-T5929, etc.)
2. ❌ Running all tests at once
3. ❌ Skipping user approval
4. ❌ Setting Zephyr to "Active" before test passes

---

## Overview

This workflow creates new E2E tests from scratch with **mandatory** Zephyr synchronization. All 10 steps must be completed - no optional steps.

**Key Principles:**
- ❌ **NO optional steps** - All steps are mandatory
- ❌ **NO skipping test execution** - Tests must pass before proceeding
- ❌ **NO Zephyr bypass** - Zephyr sync is required
- ❌ **NO fake MM-T numbers** - Use MM-TXXX until real IDs from Zephyr
- ✅ **Strict validation** - Each stage validates before proceeding
- ✅ **Auto-healing** - Tests are fixed until they pass
- ✅ **Status updates** - Zephyr updated to "Active" only after tests pass
- ✅ **One test at a time** - Run with --headed --project=chrome --grep

## Trigger

User requests to create new E2E tests for a feature:
- "Create tests for post reactions"
- "Create E2E tests for channel sidebar"
- "Generate tests for login feature"

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
│  │  Step 3E: EXECUTE TESTS (MANDATORY)                        │  │
│  │    - Run: npx playwright test <file> --project=chrome     │  │
│  │    - MUST verify tests pass                               │  │
│  │    - If failing → invoke Healer Agent                     │  │
│  │                                                             │  │
│  │  Step 3F: HEAL TESTS UNTIL PASSING (if needed)            │  │
│  │    - Analyze failures                                      │  │
│  │    - Fix selector/timing/assertion issues                 │  │
│  │    - Re-run tests                                          │  │
│  │    - Repeat until ALL tests pass                          │  │
│  │                                                             │  │
│  │  Step 3G: UPDATE ZEPHYR STATUS TO "ACTIVE"                │  │
│  │    - Update status: "Active"                               │  │
│  │    - Add automation metadata                               │  │
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
- **Zephyr API failure**: Retry with exponential backoff (3 attempts), then abort
- **Placeholder replacement fails**: Rollback and report error, abort workflow
- **Code generation fails**: Report error, attempt fix, retry once, then abort if still failing
- **Test execution fails**: ⚠️ **MANDATORY** - Invoke Healer Agent, fix issues, re-run until passing
- **Healing fails after 3 attempts**: Report to user, request manual intervention
- **Zephyr update fails**: Retry 3 times, then warn user but tests remain valid locally

## Configuration Requirements

### `.claude/settings.local.json`

```json
{
  "zephyr": {
    "baseUrl": "https://mattermost.atlassian.net",
    "jiraToken": "YOUR_JIRA_PAT",
    "zephyrToken": "YOUR_ZEPHYR_TOKEN",
    "projectKey": "MM",
    "folderId": "28243013"
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
---

## Detailed 10-Step Process

### Step 1: Launch Browser via MCP
- Use Playwright MCP to launch real browser
- Navigate to Mattermost application
- Take screenshots for documentation

### Step 2: Explore UI
- Interact with feature UI
- Discover actual selectors from DOM
- Identify data-testid attributes, ARIA labels
- Document timing and async behavior

### Step 3: Discover Actual Selectors
- Inspect DOM elements
- Extract data-testid, aria-label, role attributes
- Validate selectors work correctly
- Document all discovered selectors

### Step 4: Create Skeleton Tests
- Generate .spec.ts files (one per scenario)
- Include JSDoc with @objective and @test steps
- Use MM-TXXX placeholder in test title
- Leave test body empty (implementation comes later)

**Example Skeleton:**
```typescript
/**
 * @objective Verify user can add reaction to post
 * @test steps
 *  1. Navigate to channel with existing post
 *  2. Hover over post to reveal reaction button
 *  3. Click reaction button
 *  4. Select emoji from picker
 *  5. Verify reaction appears on post
 */
test('MM-TXXX user can add reaction to post', {tag: '@messaging'}, async ({pw}) => {
  // implementation to be generated after Zephyr sync
});
```

### Step 5: User Confirmation
- Show generated skeleton files to user
- Ask: "Should I create Zephyr Test Cases for these scenarios now?"
- Wait for explicit "yes" confirmation
- If "no", stop here - files remain with MM-TXXX

### Step 6: Push to Zephyr (Create Test Cases)
- For each skeleton file, create test case in Zephyr
- Use Zephyr API to create cases
- Retrieve actual test keys (MM-T1234, MM-T1235, etc.)
- Store mapping: skeleton file → Zephyr key

**Zephyr Test Case Fields:**
- Name: From test title (without MM-TXXX)
- Objective: From @objective JSDoc
- Test Steps: From @test steps JSDoc
- Status: Draft (not Active yet - tests haven't passed)
- Folder: From configuration
- Labels: playwright-e2e, ai-generated

### Step 7: Generate Full Playwright Code
- Use existing Generator Agent
- Apply Mattermost patterns (pw fixture, page objects)
- Use discovered selectors from Step 3
- Generate complete test implementation
- Replace empty test body with full code

**Example Full Code:**
```typescript
/**
 * @objective Verify user can add reaction to post
 * @test steps
 *  1. Navigate to channel with existing post
 *  2. Hover over post to reveal reaction button
 *  3. Click reaction button
 *  4. Select emoji from picker
 *  5. Verify reaction appears on post
 * @zephyr MM-T5928
 */
test('MM-T5928 user can add reaction to post', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    
    // # Navigate to channel
    await channelsPage.goto(team.name);
    
    // # Create a test post
    const postText = 'Test post for reactions';
    await channelsPage.postMessage(postText);
    
    // # Hover over post to reveal actions
    const post = channelsPage.page.locator(`text=${postText}`).locator('..');
    await post.hover();
    
    // # Click reaction button
    await post.locator('[data-testid="post-reaction-button"]').click();
    
    // # Select emoji
    await channelsPage.page.locator('[data-testid="emoji-picker"]').waitFor();
    await channelsPage.page.locator('[data-emoji-name="thumbsup"]').click();
    
    // * Verify reaction appears
    await expect(post.locator('[data-testid="reaction-thumbsup"]')).toBeVisible();
    await expect(post.locator('[data-testid="reaction-count"]')).toHaveText('1');
});
```

### Step 8: Place in ai-assisted Directory
- Write files to: `specs/functional/ai-assisted/{category}/`
- Category based on feature area:
  - channels/ - Channel-related tests
  - messaging/ - Message, post, thread tests
  - system_console/ - Admin console tests
- Use descriptive filenames: `{feature}_{action}.spec.ts`

### Step 9: Run Tests with Chrome
- Execute: `npx playwright test <file> --project=chrome`
- Capture output (stdout, stderr)
- Check exit code
- If exit code !== 0, tests failed → go to Step 10

**Example Execution:**
```bash
npx playwright test specs/functional/ai-assisted/messaging/post_reactions.spec.ts --project=chrome

Running 2 tests using 1 worker
  ✓ MM-T5928 user can add reaction to post (3.2s)
  ✓ MM-T5929 user can remove reaction from post (2.8s)

  2 passed (6s)
```

### Step 10: Fix Tests Until Passing
**IF tests fail:**
- Invoke Healer Agent
- Analyze failure logs
- Common issues:
  - Selector not found → Use MCP to discover updated selector
  - Timing issue → Add proper waits
  - Assertion failed → Fix expected value
- Apply fixes
- Re-run tests
- Repeat until all tests pass (max 3 heal attempts)
- If still failing after 3 attempts → alert user

**THEN once all tests pass:**
- Update Zephyr status to "Active"
- Add automation metadata:
  - automationStatus: "Automated"
  - automationFilePath: "specs/functional/ai-assisted/..."
  - automatedOn: timestamp
  - automationFramework: "Playwright"
- Add label: `playwright-automated`

---

## Success Criteria

A workflow is considered successful when:
1. ✅ All 10 steps completed
2. ✅ All generated tests pass
3. ✅ Zephyr cases created with actual MM-T keys
4. ✅ Files contain full implementation (not skeletons)
5. ✅ Zephyr status updated to "Active"
6. ✅ All tests run with `--project=chrome`

---

## Validation Checkpoints

### After Step 4:
- [ ] Skeleton files exist
- [ ] Files contain JSDoc with @objective and @test steps
- [ ] Test titles use MM-TXXX placeholder
- [ ] Test bodies are empty or have comment

### After Step 6:
- [ ] Zephyr API returned test keys
- [ ] Mapping file created (skeleton → Zephyr key)
- [ ] All MM-TXXX replaced with actual keys

### After Step 7:
- [ ] Files contain full Playwright code
- [ ] Tests use pw fixture
- [ ] Tests use discovered selectors
- [ ] Tests follow Mattermost patterns

### After Step 9:
- [ ] Tests executed successfully
- [ ] Exit code = 0
- [ ] All tests marked as passed

### After Step 10:
- [ ] Zephyr status = "Active"
- [ ] Automation metadata added
- [ ] File paths correct in Zephyr

