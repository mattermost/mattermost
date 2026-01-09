# Automate Existing Test Workflow

## Overview

This workflow automates an existing Zephyr test case by fetching its details, generating or updating test steps if needed, creating full Playwright automation, and syncing back to Zephyr.

## Trigger

User requests to automate a specific Zephyr test case:
- "Automate MM-T1234"
- "Generate automation for MM-T5678"
- "Create E2E test for MM-T9999"

## Workflow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     User Request                                  │
│              "Automate MM-T1234"                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│               Step 1: Parse Request & Validate                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - Extract test key (MM-T1234)                             │  │
│  │  - Validate format                                         │  │
│  │  - Parse options (skipExecution, overwrite, etc.)          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│               Step 2: Fetch Test Case from Zephyr                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - Load Zephyr config                                      │  │
│  │  - Call Zephyr API: GET /testcase/MM-T1234                 │  │
│  │  - Retrieve:                                               │  │
│  │    • Test name                                             │  │
│  │    • Objective                                             │  │
│  │    • Test steps (may be empty)                             │  │
│  │    • Labels, status, priority                              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│            Step 3: Validate/Generate Test Steps                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Are test steps present and detailed?                      │  │
│  │    YES → Use existing steps                                │  │
│  │    NO  → Generate steps from name + objective              │  │
│  │                                                             │  │
│  │  If generated:                                             │  │
│  │    - Use LLM or rule-based inference                       │  │
│  │    - Create 3-6 actionable test steps                      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│         Step 4: Update Zephyr (if steps were generated)           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - Call Zephyr API: PUT /testcase/MM-T1234                 │  │
│  │  - Update testScript with generated steps                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│          Step 5: Generate Playwright Automation Code              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - Infer category from test name/labels                    │  │
│  │  - Prepare code generation request                         │  │
│  │  - Invoke existing Generator Agent                         │  │
│  │  - Receive complete Playwright implementation              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│               Step 6: Write/Update Local File                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - Generate file name from test name                       │  │
│  │  - Determine file path based on category                   │  │
│  │  - Check if file exists:                                   │  │
│  │    • overwrite=true → Replace file                         │  │
│  │    • overwrite=false → Create new with timestamp           │  │
│  │  - Write complete test file                                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│            Step 7: (Optional) Execute Test                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  If skipExecution=false:                                   │  │
│  │    - Run: npx playwright test <file> --project=chrome      │  │
│  │    - Capture result (pass/fail)                            │  │
│  │    - Log output                                            │  │
│  │                                                             │  │
│  │  If test fails:                                            │  │
│  │    - Log failure details                                   │  │
│  │    - Continue (don't block workflow)                       │  │
│  │    - (Optional) Invoke Healer Agent                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│         Step 8: Update Zephyr with Automation Metadata            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - Call Zephyr API: PUT /testcase/MM-T1234                 │  │
│  │  - Update:                                                 │  │
│  │    • status: "Approved" (if test passed)                   │  │
│  │    • Automation Status: "Automated"                        │  │
│  │    • Automation File: <path>                               │  │
│  │    • Last Automated: <timestamp>                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                     Workflow Complete                             │
│  - Automation file created/updated                                │
│  - Test executed (if requested)                                   │
│  - Zephyr updated with automation details                         │
└──────────────────────────────────────────────────────────────────┘
```

## Detailed Steps

### Step 1: Parse Request & Validate

**Input**: User message containing Zephyr test key

**Process**:
1. Extract test key using regex: `/MM-T\d+/i`
2. Validate format (must match MM-TXXXX)
3. Parse optional flags:
   - `skipExecution`: Don't run test after generation
   - `overwrite`: Overwrite existing file if found

**Output**: AutomationRequest object

**Example**:
```typescript
{
  testKey: "MM-T1234",
  options: {
    skipExecution: false,
    overwriteExisting: true
  }
}
```

### Step 2: Fetch Test Case from Zephyr

**API Call**: `GET /rest/atm/1.0/testcase/MM-T1234`

**Process**:
1. Load Zephyr configuration from `.claude/settings.local.json`
2. Make authenticated API call
3. Parse response
4. Validate required fields exist (name, objective)

**Example Response**:
```json
{
  "key": "MM-T1234",
  "name": "Test successful login",
  "objective": "Verify user can login with valid credentials",
  "precondition": "User account exists in system",
  "status": "Approved",
  "priority": "High",
  "labels": ["auth", "login", "critical"],
  "testScript": {
    "type": "STEP_BY_STEP",
    "steps": [
      {
        "description": "Navigate to login page",
        "testData": "URL: https://example.com/login",
        "expectedResult": "Login page displays"
      },
      {
        "description": "Enter valid credentials",
        "testData": "username: testuser, password: testpass",
        "expectedResult": "Credentials accepted"
      }
    ]
  }
}
```

**Error Handling**:
- 404 Not Found → Report: "Test case MM-T1234 does not exist"
- 401/403 → Report: "Authentication failed, check Zephyr credentials"
- Network error → Retry with exponential backoff (3 attempts)

### Step 3: Validate/Generate Test Steps

**Scenario A: Test Steps Exist**

If `testScript.steps` exists and has detailed descriptions:
```
✓ Test steps already exist
Using 4 existing steps from Zephyr
```

**Scenario B: Test Steps Missing or Incomplete**

If `testScript.steps` is empty or contains only placeholder text:
```
⚠️  Test steps missing or incomplete, generating...
```

**Generation Logic**:

Option 1: LLM-based (preferred)
```typescript
const prompt = `
Generate detailed test steps for:

Test Name: ${testCase.name}
Objective: ${testCase.objective}

Generate 3-6 clear, actionable test steps that verify this functionality.
Format: Start each step with an action verb (Navigate, Enter, Click, Verify, etc.)
`;

const steps = await invokeLLM(prompt);
```

Option 2: Rule-based inference
```typescript
function inferTestSteps(name: string, objective: string): string[] {
  const steps = [];

  // Add navigation
  if (name.includes('login')) {
    steps.push('Navigate to the login page');
  } else if (name.includes('channel')) {
    steps.push('Navigate to the channels page');
  }

  // Add actions based on keywords
  if (name.includes('create')) {
    steps.push('Click create button');
    steps.push('Fill in required fields');
    steps.push('Submit the form');
  }

  // Add verification
  steps.push('Verify the expected result');

  return steps;
}
```

**Output**:
```typescript
{
  steps: [
    "Navigate to login page",
    "Enter valid username and password",
    "Click Login button",
    "Verify user is redirected to dashboard"
  ],
  source: "generated" // or "existing"
}
```

### Step 4: Update Zephyr (if steps were generated)

**API Call**: `PUT /rest/atm/1.0/testcase/MM-T1234`

**Payload**:
```json
{
  "testScript": {
    "type": "STEP_BY_STEP",
    "steps": [
      {
        "description": "Navigate to login page",
        "testData": "",
        "expectedResult": "Login page is visible"
      },
      {
        "description": "Enter valid username and password",
        "testData": "username: testuser, password: testpass",
        "expectedResult": "Credentials are accepted"
      },
      {
        "description": "Click Login button",
        "testData": "",
        "expectedResult": "Login request is submitted"
      },
      {
        "description": "Verify user is redirected to dashboard",
        "testData": "",
        "expectedResult": "Dashboard page is displayed"
      }
    ]
  }
}
```

**Output**:
```
✓ Updated test steps in Zephyr: MM-T1234
```

**Note**: If update fails, log warning but continue. Local automation is the priority.

### Step 5: Generate Playwright Automation Code

**Process**:

1. **Infer Category**:
   ```typescript
   function inferCategory(testCase: ZephyrTestCase): string {
     // Check labels first
     if (testCase.labels.includes('auth')) return 'auth';
     if (testCase.labels.includes('channels')) return 'channels';
     if (testCase.labels.includes('messaging')) return 'messaging';

     // Check name
     if (testCase.name.toLowerCase().includes('login')) return 'auth';
     if (testCase.name.toLowerCase().includes('channel')) return 'channels';

     return 'functional';
   }
   ```

2. **Prepare Generation Request**:
   ```typescript
   const request = {
     testKey: "MM-T1234",
     testName: "Test successful login",
     objective: "Verify user can login with valid credentials",
     precondition: "User account exists in system",
     steps: ["Navigate to login page", ...],
     category: "auth"
   };
   ```

3. **Invoke Existing Generator Agent**:
   - Reuse the existing `generator.md` agent
   - Pass test metadata
   - Receive complete Playwright code

**Example Generated Code**:
```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can login with valid credentials
 * @precondition User account exists in system
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
    await expect(loginPage.page).toHaveURL(/.*\/login/);

    // # Enter valid username and password
    await loginPage.fillCredentials(user.username, user.password);

    // # Click Login button
    await loginPage.clickLoginButton();

    // * Verify user is redirected to dashboard
    await expect(pw.page).toHaveURL(/.*\/channels\/.*/);
    await expect(pw.page.locator('[data-testid="sidebar-header"]')).toBeVisible();
});
```

### Step 6: Write/Update Local File

**Process**:

1. **Generate File Path**:
   ```typescript
   const fileName = "test_successful_login.spec.ts"; // from test name
   const filePath = `e2e-tests/playwright/specs/functional/auth/${fileName}`;
   ```

2. **Check If File Exists**:
   - If exists AND `overwriteExisting=true` → Replace file
   - If exists AND `overwriteExisting=false` → Create `file_${timestamp}.spec.ts`
   - If not exists → Create new file

3. **Write File**:
   ```typescript
   fs.mkdirSync(path.dirname(filePath), { recursive: true });
   fs.writeFileSync(filePath, generatedCode, 'utf-8');
   ```

**Output**:
```
✓ Created file: e2e-tests/playwright/specs/functional/auth/test_successful_login.spec.ts
```
or
```
✓ Updated file: e2e-tests/playwright/specs/functional/auth/test_successful_login.spec.ts
```

### Step 7: (Optional) Execute Test

**Process**:

If `skipExecution=false`:

1. **Run Test**:
   ```bash
   cd e2e-tests/playwright
   npx playwright test specs/functional/auth/test_successful_login.spec.ts --project=chrome
   ```

2. **Capture Output**:
   ```typescript
   const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
   ```

3. **Determine Result**:
   - Exit code 0 → Test passed
   - Exit code non-zero → Test failed

**Example Output (Success)**:
```
Running test: MM-T1234

Running 1 test using 1 worker

  ✓  [chromium] › test_successful_login.spec.ts:8:1 › MM-T1234 Test successful login (2.3s)

  1 passed (3.1s)

✓ Test passed: MM-T1234
```

**Example Output (Failure)**:
```
Running test: MM-T1234

Running 1 test using 1 worker

  ✗  [chromium] › test_successful_login.spec.ts:8:1 › MM-T1234 Test successful login (5.2s)

  Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

✗ Test failed: MM-T1234
(Workflow continues - failure doesn't block)
```

**Note**: Test execution is **optional** and **non-blocking**. Even if the test fails, the workflow completes successfully because the automation file has been created.

### Step 8: Update Zephyr with Automation Metadata

**API Call**: `PUT /rest/atm/1.0/testcase/MM-T1234`

**Payload (Test Passed)**:
```json
{
  "status": "Approved",
  "customFields": {
    "Automation Status": "Automated",
    "Automation File": "specs/functional/auth/test_successful_login.spec.ts",
    "Last Automated": "2025-01-15T14:30:00Z"
  }
}
```

**Payload (Test Failed)**:
```json
{
  "status": "Draft",
  "customFields": {
    "Automation Status": "Automation Failed",
    "Automation File": "specs/functional/auth/test_successful_login.spec.ts",
    "Last Automated": "2025-01-15T14:30:00Z",
    "Failure Reason": "Timed out waiting for element"
  }
}
```

**Output**:
```
✓ Updated Zephyr metadata: MM-T1234
```

## Complete Output Example

### Scenario: Automate with existing test steps

```
User: Automate MM-T1234

=== Automating Test: MM-T1234 ===

Step 1: Loading Zephyr configuration...
✓ Connected to: https://mattermost.atlassian.net

Step 2: Fetching test case from Zephyr...
✓ Fetched: Test successful login

Step 3: Validating test steps...
✓ Test steps already exist (4 steps found)

Step 4: Skipped (test steps already exist)

Step 5: Generating Playwright automation...
✓ Automation code generated

Step 6: Writing automation file...
✓ Created file: e2e-tests/playwright/specs/functional/auth/test_successful_login.spec.ts

Step 7: Executing test...
Running test: MM-T1234
✓ Test passed: MM-T1234

Step 8: Updating Zephyr with automation metadata...
✓ Updated Zephyr metadata: MM-T1234

=== Automation Complete: MM-T1234 ===

Summary:
  Test Key: MM-T1234
  Test Name: Test successful login
  File: e2e-tests/playwright/specs/functional/auth/test_successful_login.spec.ts
  Status: Passed
```

### Scenario: Automate with missing test steps

```
User: Automate MM-T5678

=== Automating Test: MM-T5678 ===

Step 1: Loading Zephyr configuration...
✓ Connected to: https://mattermost.atlassian.net

Step 2: Fetching test case from Zephyr...
✓ Fetched: Create public channel

Step 3: Validating test steps...
⚠️  Test steps missing or incomplete, generating...
✓ Generated 5 test steps

Step 4: Updating Zephyr with generated test steps...
✓ Updated test steps in Zephyr: MM-T5678

Step 5: Generating Playwright automation...
✓ Automation code generated

Step 6: Writing automation file...
✓ Created file: e2e-tests/playwright/specs/functional/channels/create_public_channel.spec.ts

Step 7: Executing test...
Running test: MM-T5678
✓ Test passed: MM-T5678

Step 8: Updating Zephyr with automation metadata...
✓ Updated Zephyr metadata: MM-T5678

=== Automation Complete: MM-T5678 ===

Summary:
  Test Key: MM-T5678
  Test Name: Create public channel
  File: e2e-tests/playwright/specs/functional/channels/create_public_channel.spec.ts
  Status: Passed
```

## Error Handling

### Test Case Not Found
```
Error: Test case MM-T9999 not found or inaccessible
- Verify test key is correct
- Check Zephyr credentials have proper permissions
```

### Missing Required Fields
```
Warning: Test case MM-T1234 missing objective
- Using test name as objective
- Continuing with automation...
```

### Zephyr Update Failures
```
⚠️  Failed to update Zephyr: Network timeout
- Local automation file created successfully
- Zephyr update can be retried later
```

### Test Execution Failures
```
✗ Test failed: MM-T1234
- Automation file created: test_successful_login.spec.ts
- Review failure output above
- Consider invoking Healer Agent for fixes
```

## Options and Variations

### Skip Test Execution
```
User: Automate MM-T1234 but don't run it yet

Options: { skipExecution: true }

Output:
...
Step 7: Skipped test execution
...
```

### Don't Overwrite Existing File
```
User: Automate MM-T1234 and keep the existing file

Options: { overwriteExisting: false }

Output:
Step 6: Writing automation file...
⚠️  File already exists: test_successful_login.spec.ts
✓ Created new file: test_successful_login_1705327800000.spec.ts
```

## Integration with Main Workflow

Both workflows are independent and triggered by different user intents:

```typescript
function routeWorkflow(userInput: string) {
  if (userInput.match(/automate\s+MM-T\d+/i)) {
    // Use: Automate Existing Test workflow
    return automateExistingTest(userInput);
  } else if (userInput.match(/create tests|generate tests/i)) {
    // Use: Main 3-Stage Pipeline workflow
    return mainWorkflow(userInput);
  }
}
```

## Configuration Requirements

Same as main workflow: `.claude/settings.local.json`

```json
{
  "zephyr": {
    "baseUrl": "https://mattermost.atlassian.net",
    "jiraToken": "YOUR_JIRA_PAT",
    "zephyrToken": "YOUR_ZEPHYR_TOKEN",
    "projectKey": "MM"
  }
}
```

## Advantages of This Workflow

1. **Flexible**: Works with incomplete Zephyr test cases
2. **Intelligent**: Generates missing test steps automatically
3. **Bi-directional**: Updates both local files and Zephyr
4. **Non-blocking**: Test failures don't stop automation file creation
5. **Reusable**: Leverages existing generator agent for code quality
