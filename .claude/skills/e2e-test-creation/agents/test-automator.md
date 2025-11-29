# Test Automator Agent

## Purpose

Automates an existing Zephyr test case by fetching its details, generating/updating test steps if needed, creating full Playwright automation code, and updating both the local file and Zephyr with the implementation.

## Role in Workflow

**Position**: Alternative workflow triggered by user request

**Trigger**: User says "Automate MM-T1234" (or similar)

**Input**: Zephyr test case key (e.g., MM-T1234)
**Output**: Complete `.spec.ts` file with full Playwright automation + updated Zephyr test case

## Responsibilities

1. ✅ Fetch test case details from Zephyr using provided key
2. ✅ Validate test case exists and has required fields
3. ✅ Generate or refine test steps if missing/incomplete
4. ✅ Update Zephyr with generated test steps (keep status as Draft)
5. ✅ Generate full Playwright automation code
6. ✅ Write/update local `.spec.ts` file in `ai-assisted/` directory
7. ✅ **MANDATORY: Execute test with Chrome** (`--project=chrome`)
8. ✅ **MANDATORY: Invoke healer if test fails** (fix until passing)
9. ✅ **MANDATORY: Update Zephyr status to "Active"** (only after test passes)
10. ✅ Add automation metadata (file path, timestamp, framework)

## Workflow Steps

### Step 1: Parse User Request

```typescript
interface AutomationRequest {
  testKey: string;
  options?: {
    overwriteExisting?: boolean;
  };
}

function parseAutomationRequest(userInput: string): AutomationRequest {
  // Match patterns:
  // - "Automate MM-T1234"
  // - "Generate automation for MM-T1234"
  // - "Create E2E test for MM-T1234"

  const testKeyPattern = /MM-T\d+/i;
  const match = userInput.match(testKeyPattern);

  if (!match) {
    throw new Error('No valid Zephyr test key found in request');
  }

  return {
    testKey: match[0].toUpperCase(),
    options: {
      overwriteExisting: true
    }
  };
}

// Note: Test execution is ALWAYS mandatory - no skip option
```

### Step 2: Fetch Test Case from Zephyr

```typescript
interface ZephyrTestCase {
  key: string;
  name: string;
  objective: string;
  precondition?: string;
  status: string;
  priority: string;
  labels: string[];
  testScript?: {
    type: string;
    steps: Array<{
      description: string;
      testData: string;
      expectedResult: string;
    }>;
  };
  customFields?: Record<string, any>;
}

async function fetchTestCaseFromZephyr(
  testKey: string,
  config: ZephyrConfig
): Promise<ZephyrTestCase> {
  console.log(`Fetching test case: ${testKey}`);

  try {
    const response = await callZephyrAPI(
      config,
      'get',
      testKey
    );

    console.log(`✓ Fetched: ${response.key} - ${response.name}`);
    return response as ZephyrTestCase;
  } catch (error) {
    console.error(`Failed to fetch test case ${testKey}:`, error);
    throw new Error(`Test case ${testKey} not found or inaccessible`);
  }
}
```

### Step 3: Generate or Refine Test Steps

```typescript
interface GeneratedTestSteps {
  steps: string[];
  source: 'existing' | 'generated';
}

async function ensureTestStepsExist(
  testCase: ZephyrTestCase
): Promise<GeneratedTestSteps> {
  // Check if test steps exist and are meaningful
  const hasSteps = testCase.testScript?.steps &&
                   testCase.testScript.steps.length > 0;

  const hasDetailedSteps = hasSteps &&
    testCase.testScript!.steps.some(step =>
      step.description.length > 10 // More than just placeholder text
    );

  if (hasDetailedSteps) {
    console.log('✓ Test steps already exist');
    return {
      steps: testCase.testScript!.steps.map(s => s.description),
      source: 'existing'
    };
  }

  // Generate test steps from test name and objective
  console.log('⚠️  Test steps missing or incomplete, generating...');

  const generatedSteps = await generateTestSteps(
    testCase.name,
    testCase.objective
  );

  console.log('✓ Generated test steps');
  return {
    steps: generatedSteps,
    source: 'generated'
  };
}

async function generateTestSteps(
  testName: string,
  objective: string
): Promise<string[]> {
  // Use LLM or rule-based generation to create test steps
  // This is a simplified version - in practice, you'd use the existing planner

  const prompt = `
Generate detailed test steps for the following test case:

Test Name: ${testName}
Objective: ${objective}

Generate 3-6 clear, actionable test steps that would verify this functionality.
Format each step as a single sentence starting with an action verb.

Example:
1. Navigate to the login page
2. Enter valid credentials
3. Click the Login button
4. Verify successful login
`;

  // This would invoke an LLM or use existing planner logic
  // For now, return a basic structure
  return inferTestSteps(testName, objective);
}

function inferTestSteps(testName: string, objective: string): string[] {
  // Simple rule-based inference
  const steps: string[] = [];

  const nameLower = testName.toLowerCase();

  // Add navigation step
  if (nameLower.includes('login')) {
    steps.push('Navigate to the login page');
  } else if (nameLower.includes('channel')) {
    steps.push('Navigate to the channels page');
  } else {
    steps.push('Navigate to the application');
  }

  // Add action steps based on test name keywords
  if (nameLower.includes('create')) {
    steps.push('Click the create button');
    steps.push('Fill in required fields');
    steps.push('Submit the form');
  } else if (nameLower.includes('login')) {
    steps.push('Enter credentials');
    steps.push('Click Login button');
  } else if (nameLower.includes('search')) {
    steps.push('Enter search term');
    steps.push('Click search button');
  }

  // Add verification step
  steps.push('Verify the expected result');

  return steps;
}
```

### Step 4: Update Zephyr with Test Steps

```typescript
async function updateZephyrTestSteps(
  testKey: string,
  steps: string[],
  config: ZephyrConfig
): Promise<void> {
  console.log(`Updating test steps in Zephyr for ${testKey}`);

  const updatePayload = {
    testScript: {
      type: 'STEP_BY_STEP',
      steps: steps.map((step, index) => ({
        description: step,
        testData: '',
        expectedResult: `Step ${index + 1} completes successfully`
      }))
    }
  };

  const payloadFile = `/tmp/zephyr-update-steps-${testKey}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify(updatePayload, null, 2));

  try {
    await callZephyrAPI(config, 'update', testKey, payloadFile);
    console.log(`✓ Updated test steps in Zephyr: ${testKey}`);
    fs.unlinkSync(payloadFile);
  } catch (error) {
    console.error(`Failed to update test steps for ${testKey}:`, error);
    // Don't throw - continue with local automation even if Zephyr update fails
  }
}
```

### Step 5: Generate Playwright Automation Code

```typescript
async function generatePlaywrightAutomation(
  testCase: ZephyrTestCase,
  steps: string[]
): Promise<string> {
  console.log(`Generating Playwright code for ${testCase.key}`);

  // Infer category from test name or labels
  const category = inferCategory(testCase);

  const request = {
    testKey: testCase.key,
    testName: testCase.name,
    objective: testCase.objective,
    precondition: testCase.precondition,
    steps,
    category
  };

  // Invoke existing generator agent
  const code = await invokeGeneratorAgent(request);

  console.log(`✓ Generated Playwright code for ${testCase.key}`);
  return code;
}

function inferCategory(testCase: ZephyrTestCase): string {
  const nameLower = testCase.name.toLowerCase();
  const labels = testCase.labels?.map(l => l.toLowerCase()) || [];

  // Check labels first
  if (labels.includes('auth') || labels.includes('authentication')) return 'auth';
  if (labels.includes('channels')) return 'channels';
  if (labels.includes('messaging')) return 'messaging';
  if (labels.includes('system_console')) return 'system_console';

  // Check name
  if (nameLower.includes('login') || nameLower.includes('auth')) return 'auth';
  if (nameLower.includes('channel')) return 'channels';
  if (nameLower.includes('message') || nameLower.includes('post')) return 'messaging';
  if (nameLower.includes('system console')) return 'system_console';

  return 'functional';
}

async function invokeGeneratorAgent(request: any): Promise<string> {
  // This reuses the existing generator agent from e2e-test-creation skill
  // The implementation would call the generator with proper context

  const stepsFormatted = request.steps
    .map((step: string, i: number) => ` *  ${i + 1}. ${step}`)
    .join('\n');

  const precondition = request.precondition
    ? ` * @precondition ${request.precondition}\n`
    : '';

  return `import {test, expect} from '@playwright/test';

/**
 * @objective ${request.objective}
${precondition}* @test steps
${stepsFormatted}
 */
test('${request.testKey} ${request.testName}', {tag: '@${request.category}'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Login as user
    const {page} = await pw.testBrowser.login(user);

    // TODO: Implement test steps
    // This would be fully generated by the existing generator agent
    // based on the test steps and Mattermost patterns

    // * Add assertions
});
`;
}
```

### Step 6: Write/Update Local File

```typescript
async function writeAutomationFile(
  testCase: ZephyrTestCase,
  code: string,
  category: string,
  overwrite: boolean = true
): Promise<string> {
  // Generate file path
  const fileName = testCase.name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^test_/, '')
    + '.spec.ts';

  const filePath = `e2e-tests/playwright/specs/functional/${category}/${fileName}`;

  // Check if file exists
  if (fs.existsSync(filePath) && !overwrite) {
    console.log(`⚠️  File already exists: ${filePath}`);
    const timestamp = Date.now();
    const newPath = filePath.replace('.spec.ts', `_${timestamp}.spec.ts`);
    fs.writeFileSync(newPath, code, 'utf-8');
    console.log(`✓ Created new file: ${newPath}`);
    return newPath;
  }

  // Ensure directory exists
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  // Write file
  fs.writeFileSync(filePath, code, 'utf-8');
  console.log(`✓ ${fs.existsSync(filePath) ? 'Updated' : 'Created'} file: ${filePath}`);

  return filePath;
}
```

### Step 7: Execute Test

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeTest(
  filePath: string,
  testKey: string
): Promise<{ success: boolean; output: string }> {
  console.log(`Executing test: ${testKey}`);

  try {
    const command = `npx playwright test ${filePath} --project=chrome`;
    const { stdout, stderr } = await execAsync(command, {
      cwd: 'e2e-tests/playwright',
      timeout: 120000
    });

    console.log(`✓ Test passed: ${testKey}`);
    return { success: true, output: stdout };
  } catch (error: any) {
    console.error(`✗ Test failed: ${testKey}`);
    console.error(error.stdout || error.message);
    return { success: false, output: error.stdout || error.message };
  }
}
```

### Step 8: Update Zephyr with Automation Metadata

```typescript
async function updateZephyrWithAutomation(
  testKey: string,
  filePath: string,
  testPassed: boolean,
  config: ZephyrConfig
): Promise<void> {
  console.log(`Updating Zephyr with automation metadata: ${testKey}`);

  const updatePayload = {
    status: testPassed ? 'Approved' : 'Draft',
    customFields: {
      'Automation Status': testPassed ? 'Automated' : 'Automation Failed',
      'Automation File': filePath,
      'Last Automated': new Date().toISOString()
    }
  };

  const payloadFile = `/tmp/zephyr-final-update-${testKey}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify(updatePayload, null, 2));

  try {
    await callZephyrAPI(config, 'update', testKey, payloadFile);
    console.log(`✓ Updated Zephyr metadata: ${testKey}`);
    fs.unlinkSync(payloadFile);
  } catch (error) {
    console.error(`Failed to update Zephyr metadata for ${testKey}:`, error);
    // Don't throw - automation file is created successfully
  }
}
```

## Complete Orchestration

```typescript
async function automateExistingTest(
  testKey: string,
  options?: AutomationRequest['options']
): Promise<void> {
  try {
    console.log(`=== Automating Test: ${testKey} ===\n`);

    // Step 1: Load configuration
    console.log('Step 1: Loading Zephyr configuration...');
    const config = loadZephyrConfig();
    console.log(`✓ Connected to: ${config.baseUrl}\n`);

    // Step 2: Fetch test case from Zephyr
    console.log('Step 2: Fetching test case from Zephyr...');
    const testCase = await fetchTestCaseFromZephyr(testKey, config);
    console.log(`✓ Fetched: ${testCase.name}\n`);

    // Step 3: Ensure test steps exist
    console.log('Step 3: Validating test steps...');
    const { steps, source } = await ensureTestStepsExist(testCase);
    console.log(`✓ Test steps ${source === 'generated' ? 'generated' : 'validated'}\n`);

    // Step 4: Update Zephyr if steps were generated
    if (source === 'generated') {
      console.log('Step 4: Updating Zephyr with generated test steps...');
      await updateZephyrTestSteps(testKey, steps, config);
      console.log('✓ Zephyr updated\n');
    } else {
      console.log('Step 4: Skipped (test steps already exist)\n');
    }

    // Step 5: Generate Playwright automation
    console.log('Step 5: Generating Playwright automation...');
    const code = await generatePlaywrightAutomation(testCase, steps);
    console.log('✓ Automation code generated\n');

    // Step 6: Write to local file
    console.log('Step 6: Writing automation file...');
    const category = inferCategory(testCase);
    const filePath = await writeAutomationFile(
      testCase,
      code,
      category,
      options?.overwriteExisting
    );
    console.log(`✓ File written: ${filePath}\n`);

    // Step 7: Execute test (optional)
    let testPassed = false;
    if (!options?.skipExecution) {
      console.log('Step 7: Executing test...');
      const result = await executeTest(filePath, testKey);
      testPassed = result.success;
      console.log(testPassed ? '✓ Test passed\n' : '✗ Test failed (see output above)\n');
    } else {
      console.log('Step 7: Skipped test execution\n');
    }

    // Step 8: Update Zephyr with automation metadata
    console.log('Step 8: Updating Zephyr with automation metadata...');
    await updateZephyrWithAutomation(testKey, filePath, testPassed, config);
    console.log('✓ Zephyr updated\n');

    console.log(`=== Automation Complete: ${testKey} ===\n`);
    console.log('Summary:');
    console.log(`  Test Key: ${testKey}`);
    console.log(`  Test Name: ${testCase.name}`);
    console.log(`  File: ${filePath}`);
    console.log(`  Status: ${testPassed ? 'Passed' : 'Created'}`);
  } catch (error) {
    console.error(`Automation failed for ${testKey}:`, error);
    throw error;
  }
}
```

## Agent Prompt

When invoked:

```
You are the Test Automator Agent for Mattermost E2E test automation.

TASK: Automate an existing Zephyr test case with full Playwright implementation.

INPUT: Zephyr test case key (e.g., MM-T1234)

WORKFLOW:
1. Fetch test case details from Zephyr API
2. Validate test case has objective and name
3. Check if test steps exist:
   - If YES: Use existing steps
   - If NO or incomplete: Generate test steps from name + objective
4. If steps were generated: Update Zephyr with new test steps
5. Generate full Playwright automation code (reuse existing generator)
6. Write/update local .spec.ts file with automation
7. (Optional) Execute test to verify it passes
8. Update Zephyr with automation metadata:
   - Automation Status: Automated
   - Automation File: <path>
   - Last Automated: <timestamp>

OUTPUT:
- Test case details from Zephyr
- Generated or existing test steps
- Full Playwright automation file path
- Test execution result (if executed)
- Confirmation of Zephyr update

REQUIREMENTS:
- Reuse existing generator agent for code generation
- Follow Mattermost patterns and conventions
- Handle missing test steps gracefully (generate them)
- Don't fail if test execution fails (log and continue)
- Provide detailed logging at each step

ERROR HANDLING:
- Test case not found: Report clear error to user
- Missing objective: Use test name as objective
- Missing steps: Generate from name + objective
- Zephyr update fails: Warn but continue (local file is priority)
- Test execution fails: Log failure but complete automation
```

## Usage Examples

### Example 1: Automate with existing steps

```typescript
// User: "Automate MM-T1234"
await automateExistingTest('MM-T1234');

// Output:
// === Automating Test: MM-T1234 ===
// Step 1: Loading Zephyr configuration...
// ✓ Connected to: https://mattermost.atlassian.net
//
// Step 2: Fetching test case from Zephyr...
// ✓ Fetched: Test successful login
//
// Step 3: Validating test steps...
// ✓ Test steps validated
//
// Step 4: Skipped (test steps already exist)
//
// Step 5: Generating Playwright automation...
// ✓ Automation code generated
//
// Step 6: Writing automation file...
// ✓ File written: e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
//
// Step 7: Executing test...
// ✓ Test passed
//
// Step 8: Updating Zephyr with automation metadata...
// ✓ Zephyr updated
//
// === Automation Complete: MM-T1234 ===
// Summary:
//   Test Key: MM-T1234
//   Test Name: Test successful login
//   File: e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
//   Status: Passed
```

### Example 2: Automate with missing steps

```typescript
// User: "Automate MM-T5678"
await automateExistingTest('MM-T5678');

// Output:
// === Automating Test: MM-T5678 ===
// ...
// Step 3: Validating test steps...
// ⚠️  Test steps missing or incomplete, generating...
// ✓ Test steps generated
//
// Step 4: Updating Zephyr with generated test steps...
// ✓ Zephyr updated
// ...
```

### Example 3: Skip execution

```typescript
// User: "Automate MM-T1234 but don't run it yet"
await automateExistingTest('MM-T1234', { skipExecution: true });

// Output:
// ...
// Step 7: Skipped test execution
// ...
```

## Integration with Main Workflow

Both workflows coexist:

```typescript
// Detect user intent
if (userInput.includes('automate') && userInput.match(/MM-T\d+/)) {
  // Workflow 2: Automate existing test
  const request = parseAutomationRequest(userInput);
  await automateExistingTest(request.testKey, request.options);
} else if (userInput.includes('create tests') || userInput.includes('generate tests')) {
  // Workflow 1: Full 3-stage pipeline
  await fullWorkflow(feature);
}
```

---

## Step 7: Execute Test (MANDATORY)

After generating the automation code, test MUST be executed:

```typescript
async function executeTest(filePath: string): Promise<{passed: boolean, output: string}> {
  const {exec} = require('child_process');
  const {promisify} = require('util');
  const execAsync = promisify(exec);

  console.log(`\n🧪 Executing test: ${filePath}`);
  
  try {
    const {stdout, stderr} = await execAsync(
      `npx playwright test ${filePath} --project=chrome`,
      {cwd: 'e2e-tests/playwright', timeout: 120000}
    );
    
    console.log(stdout);
    
    // Check if test passed
    if (stdout.includes('passed') && !stdout.includes('failed')) {
      console.log(`✅ Test passed: ${filePath}`);
      return {passed: true, output: stdout};
    } else {
      console.log(`❌ Test failed: ${filePath}`);
      return {passed: false, output: stdout + '\n' + stderr};
    }
  } catch (error) {
    console.error(`❌ Test execution failed: ${error.message}`);
    return {passed: false, output: error.stdout + '\n' + error.stderr};
  }
}
```

---

## Step 8: Heal Test Until Passing (if needed)

If test fails, invoke healer and retry:

```typescript
async function healTestUntilPassing(
  filePath: string,
  maxAttempts: number = 3
): Promise<boolean> {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    attempt++;
    console.log(`\n🔧 Attempt ${attempt}/${maxAttempts}`);
    
    // Execute test
    const result = await executeTest(filePath);
    
    if (result.passed) {
      console.log('✅ Test passing!');
      return true;
    }
    
    if (attempt >= maxAttempts) {
      console.error('❌ Failed to heal test after max attempts');
      throw new Error(`Test ${filePath} still failing after ${maxAttempts} heal attempts. Manual intervention required.`);
    }
    
    // Invoke healer agent
    console.log('🔧 Invoking Healer Agent...');
    await invokeHealerAgent(filePath, result.output);
  }
  
  return false;
}

async function invokeHealerAgent(filePath: string, errorOutput: string): Promise<void> {
  // Use Task tool to invoke healer agent
  console.log('Healer Agent analyzing failure...');
  
  // Healer will:
  // 1. Analyze error logs
  // 2. Use MCP to inspect live browser state
  // 3. Fix selector/timing/assertion issues
  // 4. Update test file with fixes
}
```

---

## Step 9: Update Zephyr Status to "Active"

**ONLY after test passes**, update Zephyr status:

```typescript
async function updateZephyrToActive(
  testKey: string,
  filePath: string,
  config: ZephyrConfig
): Promise<void> {
  console.log(`\n✅ Test passing - Updating ${testKey} to Active...\n`);

  const updatePayload = {
    statusId: 890281,  // Active status ID in Zephyr
    labels: ['playwright-automated', 'ai-generated'],
    customFields: {
      'Automation Status': 'Automated',
      'Automation File Path': filePath,
      'Automation Framework': 'Playwright',
      'Automated On': new Date().toISOString(),
      'Automated By': 'Claude AI'
    }
  };
  
  // Write to temp file
  const payloadFile = `/tmp/zephyr-update-${testKey}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify(updatePayload, null, 2));
  
  try {
    // Call Zephyr API
    await callZephyrAPI(
      config,
      'update',
      testKey,
      payloadFile
    );
    
    console.log(`✅ Updated ${testKey} status to Active`);
    
    // Clean up
    fs.unlinkSync(payloadFile);
  } catch (error) {
    console.error(`⚠️  Failed to update ${testKey}:`, error.message);
    // Don't throw - test is still valid locally
  }
}
```

---

## Complete Orchestration

The main function that ties everything together:

```typescript
async function automateExistingTestCase(testKey: string): Promise<void> {
  try {
    console.log(`\n🚀 Starting automation for ${testKey}...\n`);
    
    // Step 1: Load config
    const config = loadZephyrConfig();
    
    // Step 2: Fetch from Zephyr
    console.log('📥 Fetching test case from Zephyr...');
    const testCase = await fetchTestCaseFromZephyr(testKey, config);
    
    // Step 3: Check/generate test steps
    if (!testCase.testScript?.steps || testCase.testScript.steps.length === 0) {
      console.log('⚠️  Test steps missing - generating...');
      testCase.testScript = await generateTestSteps(testCase);
      
      // Step 4: Update Zephyr with steps
      console.log('📝 Updating Zephyr with test steps...');
      await updateZephyrTestSteps(testCase, config);
    }
    
    // Step 5: Generate Playwright code
    console.log('\n💻 Generating Playwright automation code...');
    const automation = await generateAutomationCode(testCase);
    
    // Step 6: Write file
    console.log('\n📝 Writing test file...');
    const filePath = await writeAutomationFile(testCase, automation);
    console.log(`✓ File created: ${filePath}`);
    
    // Step 7-8: Execute and heal (MANDATORY)
    console.log('\n🧪 Executing test (mandatory)...');
    const testPassing = await healTestUntilPassing(filePath, 3);
    
    if (!testPassing) {
      throw new Error('Could not get test to pass. Manual intervention required.');
    }
    
    // Step 9: Update Zephyr to Active
    await updateZephyrToActive(testKey, filePath, config);
    
    console.log('\n✅ ===== AUTOMATION COMPLETE =====');
    console.log(`✅ Test case: ${testKey}`);
    console.log(`✅ File: ${filePath}`);
    console.log(`✅ Test status: Passing`);
    console.log(`✅ Zephyr status: Active`);
    
  } catch (error) {
    console.error('\n❌ Automation failed:', error.message);
    console.error('\nPartial state may exist:');
    console.error(`- Zephyr test case: ${testKey} (may be in Draft status)`);
    console.error('- Local test file (may be incomplete or failing)');
    throw error;
  }
}
```

---

## Usage Examples

### Example 1: Basic Usage

```
User: Automate MM-T5928

Agent:
🚀 Starting automation for MM-T5928...

📥 Fetching test case from Zephyr...
✓ Fetched: MM-T5928 - Enable content flagging in system console

💻 Generating Playwright automation code...
✓ Generated 145 lines of code

📝 Writing test file...
✓ File created: specs/functional/ai-assisted/system_console/enable_content_flagging.spec.ts

🧪 Executing test (mandatory)...
npx playwright test specs/functional/ai-assisted/system_console/enable_content_flagging.spec.ts --project=chrome

Running 1 test using 1 worker
  ✓ MM-T5928 should enable content flagging (2.5s)

  1 passed (2.5s)

✅ Test passing - Updating MM-T5928 to Active...
✅ Updated MM-T5928 status to Active

✅ ===== AUTOMATION COMPLETE =====
✅ Test case: MM-T5928
✅ File: specs/functional/ai-assisted/system_console/enable_content_flagging.spec.ts
✅ Test status: Passing
✅ Zephyr status: Active
```

### Example 2: With Test Healing

```
User: Automate MM-T5929

Agent:
🚀 Starting automation for MM-T5929...

📥 Fetching test case from Zephyr...
✓ Fetched: MM-T5929 - Configure flagging reasons

⚠️  Test steps missing - generating...
📝 Updating Zephyr with test steps...
✓ Test steps updated in Zephyr

💻 Generating Playwright automation code...
✓ Generated 178 lines of code

📝 Writing test file...
✓ File created: specs/functional/ai-assisted/system_console/configure_flagging_reasons.spec.ts

🧪 Executing test (mandatory)...
❌ Test failed: Selector not found [data-testid="reason-input-1"]

🔧 Attempt 1/3
🔧 Invoking Healer Agent...
Healer Agent analyzing failure...
✓ Fixed selector: [data-testid="flagging-reason-1"]
✓ Test file updated

🧪 Executing test...
  ✓ MM-T5929 should configure flagging reasons (3.1s)

✅ Test passing - Updating MM-T5929 to Active...
✅ Updated MM-T5929 status to Active

✅ ===== AUTOMATION COMPLETE =====
✅ Test case: MM-T5929
✅ File: specs/functional/ai-assisted/system_console/configure_flagging_reasons.spec.ts
✅ Test status: Passing (after 1 heal)
✅ Zephyr status: Active
```

---

## Key Validation Rules

Before updating Zephyr to "Active", validate:

1. ✅ Test file exists
2. ✅ Test contains actual MM-T key (not placeholder)
3. ✅ Test executed successfully
4. ✅ Exit code was 0
5. ✅ No "failed" in output
6. ✅ Zephyr API is reachable

**Only when ALL validations pass → Update status to "Active"**

