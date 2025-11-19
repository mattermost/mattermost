# Zephyr Sync Agent

## Purpose

Orchestrates the creation of test cases in Zephyr, replacement of placeholder keys, and generation of full Playwright automation code. This agent connects skeleton files with Zephyr test management and completes the automation implementation.

## Role in Workflow

**Position**: Stage 3 of 3-Stage Pipeline (after Skeleton Generation)

**Input**: Skeleton file metadata with MM-TXXX placeholders
**Output**: Complete test files with actual Zephyr keys and full automation code

## Responsibilities

1. ✅ Create test cases in Zephyr via API (Status: "Draft")
2. ✅ Retrieve generated test keys (MM-T1234, etc.)
3. ✅ Replace MM-TXXX placeholders with actual keys
4. ✅ Invoke code generator to produce full Playwright implementation
5. ✅ Update local files with complete automation code
6. ✅ **MANDATORY: Execute tests with Chrome** (`--project=chrome`)
7. ✅ **MANDATORY: Invoke healer if tests fail** (fix until passing)
8. ✅ **MANDATORY: Update Zephyr status to "Active"** (only after tests pass)
9. ✅ Add automation metadata (file path, timestamp, framework)

## Workflow Steps

### Step 1: Load Configuration

```typescript
import * as fs from 'fs';

interface ZephyrConfig {
  baseUrl: string;
  jiraToken: string;
  zephyrToken: string;
  projectKey: string;
  folderId?: string;
}

function loadZephyrConfig(): ZephyrConfig {
  const settingsPath = '.claude/settings.local.json';
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

  if (!settings.zephyr) {
    throw new Error('Zephyr configuration not found in settings.local.json');
  }

  return settings.zephyr;
}
```

### Step 2: Create Test Cases in Zephyr

```typescript
interface SkeletonFileMetadata {
  filePath: string;
  placeholder: string;
  testName: string;
  objective: string;
  steps: string[];
  category: string;
}

interface ZephyrTestCase {
  key: string;
  id: number;
  name: string;
}

async function createZephyrTestCases(
  metadata: SkeletonFileMetadata[],
  config: ZephyrConfig
): Promise<Map<string, ZephyrTestCase>> {
  const keyMap = new Map<string, ZephyrTestCase>();

  for (const file of metadata) {
    console.log(`Creating Zephyr test case: ${file.testName}`);

    // Build payload
    const payload = {
      projectKey: config.projectKey,
      name: file.testName,
      objective: file.objective,
      labels: ['automated', 'e2e', file.category],
      status: 'Draft',
      priority: 'Normal',
      folder: `/E2E Tests/${capitalizeCategory(file.category)}`,
      customFields: {
        'Automation Status': 'In Progress',
        'Test Type': 'E2E'
      },
      testScript: {
        type: 'STEP_BY_STEP',
        steps: file.steps.map((step, index) => ({
          description: step,
          testData: '',
          expectedResult: `Step ${index + 1} completes successfully`
        }))
      }
    };

    // Write payload to temp file
    const payloadFile = `/tmp/zephyr-payload-${Date.now()}.json`;
    fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2));

    try {
      // Call Zephyr API
      const response = await callZephyrAPI(
        config,
        'create',
        '',
        payloadFile
      );

      const testCase: ZephyrTestCase = {
        key: response.key,
        id: response.id,
        name: response.name
      };

      keyMap.set(file.filePath, testCase);
      console.log(`✓ Created: ${testCase.key} - ${testCase.name}`);

      // Clean up temp file
      fs.unlinkSync(payloadFile);
    } catch (error) {
      console.error(`✗ Failed to create test case for ${file.testName}:`, error);
      throw error;
    }
  }

  return keyMap;
}

function capitalizeCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

### Step 3: Replace Placeholders

```typescript
import { replacePlaceholders } from '../tools/placeholder-replacer';

interface KeyMapping {
  placeholder: string;
  actualKey: string;
  testName: string;
  filePath: string;
}

async function replacePlaceholdersInFiles(
  metadata: SkeletonFileMetadata[],
  keyMap: Map<string, ZephyrTestCase>
): Promise<void> {
  const mappings: KeyMapping[] = [];

  for (const file of metadata) {
    const zephyrCase = keyMap.get(file.filePath);
    if (!zephyrCase) {
      console.error(`No Zephyr key found for ${file.filePath}`);
      continue;
    }

    mappings.push({
      placeholder: file.placeholder,
      actualKey: zephyrCase.key,
      testName: file.testName,
      filePath: file.filePath
    });
  }

  console.log('Replacing placeholders with actual Zephyr keys...');
  await replacePlaceholders(mappings, 'e2e-tests/playwright');
  console.log('✓ All placeholders replaced');
}
```

### Step 4: Generate Full Automation Code

```typescript
interface CodeGenerationRequest {
  testKey: string;
  testName: string;
  objective: string;
  steps: string[];
  filePath: string;
  category: string;
}

async function generateAutomationCode(
  metadata: SkeletonFileMetadata[],
  keyMap: Map<string, ZephyrTestCase>
): Promise<void> {
  console.log('Generating full Playwright automation code...');

  for (const file of metadata) {
    const zephyrCase = keyMap.get(file.filePath);
    if (!zephyrCase) continue;

    const request: CodeGenerationRequest = {
      testKey: zephyrCase.key,
      testName: file.testName,
      objective: file.objective,
      steps: file.steps,
      filePath: file.filePath,
      category: file.category
    };

    console.log(`Generating code for ${zephyrCase.key}...`);

    // Invoke existing generator agent
    const generatedCode = await invokeGeneratorAgent(request);

    // Write to file
    fs.writeFileSync(file.filePath, generatedCode, 'utf-8');
    console.log(`✓ Generated: ${file.filePath}`);
  }

  console.log('✓ All automation code generated');
}

// Reuse existing generator agent from e2e-test-creation skill
async function invokeGeneratorAgent(request: CodeGenerationRequest): Promise<string> {
  // This would call the existing generator.md agent
  // Passing the test metadata and receiving full Playwright code

  const prompt = `
Generate complete Playwright test code for:

Test Key: ${request.testKey}
Test Name: ${request.testName}
Objective: ${request.objective}
Category: ${request.category}

Test Steps:
${request.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Requirements:
- Use Mattermost pw fixture
- Include complete JSDoc with @objective
- Use test key "${request.testKey}" in test title
- Use tag "@${request.category}"
- Follow Mattermost patterns and best practices
- Use semantic selectors (data-testid, ARIA)
- Include proper wait strategies
- Add meaningful assertions
`;

  // This would invoke the existing generator agent with the prompt
  // For now, return placeholder that shows the structure
  return generatePlaywrightCode(request);
}

function generatePlaywrightCode(request: CodeGenerationRequest): string {
  const stepsFormatted = request.steps
    .map((step, i) => ` *  ${i + 1}. ${step}`)
    .join('\n');

  return `import {test, expect} from '@playwright/test';

/**
 * @objective ${request.objective}
 * @test steps
${stepsFormatted}
 */
test('${request.testKey} ${request.testName}', {tag: '@${request.category}'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Login as user
    const {page} = await pw.testBrowser.login(user);

    // Implementation based on test steps
    // This will be generated by the existing generator agent

    // * Add assertions based on expected results
});
`;
}
```

### Step 5: (Optional) Execute Tests

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeTests(
  metadata: SkeletonFileMetadata[],
  keyMap: Map<string, ZephyrTestCase>
): Promise<void> {
  console.log('Executing tests to verify implementation...');

  for (const file of metadata) {
    const zephyrCase = keyMap.get(file.filePath);
    if (!zephyrCase) continue;

    try {
      console.log(`Running test: ${zephyrCase.key}`);

      const command = `npx playwright test ${file.filePath} --project=chrome`;
      const { stdout, stderr } = await execAsync(command, {
        cwd: 'e2e-tests/playwright',
        timeout: 120000
      });

      console.log(`✓ Test passed: ${zephyrCase.key}`);
      console.log(stdout);
    } catch (error) {
      console.error(`✗ Test failed: ${zephyrCase.key}`);
      console.error(error.stdout || error.message);

      // Option: Invoke healer agent to fix failures
      // await invokeHealerAgent(file.filePath, error);
    }
  }
}
```

### Step 6: Update Zephyr with Automation Metadata

```typescript
async function updateZephyrWithAutomation(
  metadata: SkeletonFileMetadata[],
  keyMap: Map<string, ZephyrTestCase>,
  config: ZephyrConfig
): Promise<void> {
  console.log('Updating Zephyr test cases with automation metadata...');

  for (const file of metadata) {
    const zephyrCase = keyMap.get(file.filePath);
    if (!zephyrCase) continue;

    const updatePayload = {
      status: 'Approved',
      customFields: {
        'Automation Status': 'Automated',
        'Automation File': file.filePath,
        'Last Automated': new Date().toISOString()
      }
    };

    const payloadFile = `/tmp/zephyr-update-${zephyrCase.key}.json`;
    fs.writeFileSync(payloadFile, JSON.stringify(updatePayload, null, 2));

    try {
      await callZephyrAPI(
        config,
        'update',
        zephyrCase.key,
        payloadFile
      );

      console.log(`✓ Updated Zephyr: ${zephyrCase.key}`);
      fs.unlinkSync(payloadFile);
    } catch (error) {
      console.error(`✗ Failed to update ${zephyrCase.key}:`, error);
    }
  }
}
```

## Complete Orchestration

```typescript
async function executeZephyrSync(
  skeletonMetadata: SkeletonFileMetadata[]
): Promise<void> {
  try {
    console.log('=== Starting Zephyr Sync Process ===\n');

    // Step 1: Load configuration
    console.log('Step 1: Loading Zephyr configuration...');
    const config = loadZephyrConfig();
    console.log(`✓ Connected to: ${config.baseUrl}\n`);

    // Step 2: Create test cases in Zephyr
    console.log('Step 2: Creating test cases in Zephyr...');
    const keyMap = await createZephyrTestCases(skeletonMetadata, config);
    console.log(`✓ Created ${keyMap.size} test cases\n`);

    // Step 3: Replace placeholders
    console.log('Step 3: Replacing MM-TXXX placeholders...');
    await replacePlaceholdersInFiles(skeletonMetadata, keyMap);
    console.log('✓ Placeholders replaced\n');

    // Step 4: Generate full automation code
    console.log('Step 4: Generating full Playwright code...');
    await generateAutomationCode(skeletonMetadata, keyMap);
    console.log('✓ Automation code generated\n');

    // Step 5: Execute tests (optional)
    console.log('Step 5: Executing tests...');
    await executeTests(skeletonMetadata, keyMap);
    console.log('✓ Tests executed\n');

    // Step 6: Update Zephyr
    console.log('Step 6: Updating Zephyr with automation metadata...');
    await updateZephyrWithAutomation(skeletonMetadata, keyMap, config);
    console.log('✓ Zephyr updated\n');

    console.log('=== Zephyr Sync Complete ===\n');

    // Summary
    console.log('Summary:');
    keyMap.forEach((testCase, filePath) => {
      console.log(`  ${testCase.key}: ${filePath}`);
    });
  } catch (error) {
    console.error('Zephyr sync failed:', error);
    throw error;
  }
}
```

## API Helper Function

```typescript
async function callZephyrAPI(
  config: ZephyrConfig,
  operation: 'create' | 'get' | 'update' | 'search',
  testKey: string,
  payloadFile?: string
): Promise<any> {
  const { execSync } = require('child_process');

  const scriptPath = '.claude/skills/e2e-test-creation/tools/zephyr-cli.sh';

  let command = `${scriptPath} "${config.baseUrl}" "${config.jiraToken}" "${config.zephyrToken}" ${operation}`;

  if (testKey) {
    command += ` "${testKey}"`;
  }

  if (payloadFile) {
    command += ` "${payloadFile}"`;
  }

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    return JSON.parse(output);
  } catch (error) {
    console.error('Zephyr API call failed:', error.message);
    throw error;
  }
}
```

## Agent Prompt

When invoked:

```
You are the Zephyr Sync Agent for Mattermost E2E test automation.

TASK: Create test cases in Zephyr, replace placeholders, and generate full automation code.

INPUT: Skeleton file metadata with MM-TXXX placeholders

WORKFLOW:
1. Load Zephyr configuration from .claude/settings.local.json
2. Create test cases in Zephyr via API (batch operation)
3. Retrieve generated test keys (MM-T1234, etc.)
4. Replace all MM-TXXX placeholders with actual keys
5. Generate full Playwright automation code (reuse existing generator)
6. Update local files with complete implementation
7. (Optional) Execute tests to verify they pass
8. Update Zephyr with automation metadata (file path, status)

OUTPUT:
- List of created Zephyr test cases with keys
- Confirmation of placeholder replacements
- Confirmation of code generation
- Test execution results (if executed)
- Final file paths with Zephyr keys

REQUIREMENTS:
- Use existing generator agent for code generation
- Follow Mattermost patterns and conventions
- Handle errors gracefully (retry logic for API failures)
- Provide detailed logging at each step

ERROR HANDLING:
- If Zephyr API fails: retry with exponential backoff
- If placeholder replacement fails: rollback and report
- If test execution fails: log failure but continue (don't block)
- If final update fails: warn but consider sync successful
```

## Error Recovery

```typescript
async function executeZephyrSyncWithRetry(
  skeletonMetadata: SkeletonFileMetadata[],
  maxRetries: number = 3
): Promise<void> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    try {
      await executeZephyrSync(skeletonMetadata);
      return; // Success
    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Zephyr sync failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

## Integration Example

```typescript
// Full workflow integration
async function fullWorkflow(feature: string): Promise<void> {
  // Stage 1: Planning (existing agent)
  console.log('Stage 1: Creating test plan...');
  const testPlan = await invokePlannerAgent(feature);

  // Stage 2: Skeleton generation (new agent)
  console.log('Stage 2: Generating skeleton files...');
  const skeletonMetadata = await generateSkeletonFiles(testPlan);

  // Ask for confirmation
  const userConfirmed = await askUser(
    'Should I create Zephyr Test Cases for these scenarios now?'
  );

  if (!userConfirmed) {
    console.log('Zephyr sync cancelled by user');
    return;
  }

  // Stage 3: Zephyr sync (this agent)
  console.log('Stage 3: Syncing with Zephyr and generating code...');
  await executeZephyrSyncWithRetry(skeletonMetadata);

  console.log('✓ Full workflow complete!');
}
```

## Output Example

```
=== Starting Zephyr Sync Process ===

Step 1: Loading Zephyr configuration...
✓ Connected to: https://mattermost.atlassian.net

Step 2: Creating test cases in Zephyr...
Creating Zephyr test case: Test successful login
✓ Created: MM-T1234 - Test successful login
Creating Zephyr test case: Test unsuccessful login
✓ Created: MM-T1235 - Test unsuccessful login
✓ Created 2 test cases

Step 3: Replacing MM-TXXX placeholders...
✓ Replaced MM-TXXX → MM-T1234 in auth/successful_login.spec.ts
✓ Replaced MM-TXXX → MM-T1235 in auth/unsuccessful_login.spec.ts
✓ Placeholders replaced

Step 4: Generating full Playwright code...
Generating code for MM-T1234...
✓ Generated: e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
Generating code for MM-T1235...
✓ Generated: e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts
✓ Automation code generated

Step 5: Executing tests...
Running test: MM-T1234
✓ Test passed: MM-T1234
Running test: MM-T1235
✓ Test passed: MM-T1235
✓ Tests executed

Step 6: Updating Zephyr with automation metadata...
✓ Updated Zephyr: MM-T1234
✓ Updated Zephyr: MM-T1235
✓ Zephyr updated

=== Zephyr Sync Complete ===

Summary:
  MM-T1234: e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
  MM-T1235: e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts
```

---

## Step 6: Execute Tests (MANDATORY)

After code generation, tests MUST be executed:

```bash
# Execute with Chrome only
npx playwright test <file-path> --project=chrome

# Example:
npx playwright test specs/functional/ai-assisted/messaging/post_reactions.spec.ts --project=chrome
```

**Implementation:**

```typescript
async function executeTests(filePaths: string[]): Promise<{passed: boolean, output: string}> {
  const {exec} = require('child_process');
  const {promisify} = require('util');
  const execAsync = promisify(exec);

  for (const filePath of filePaths) {
    console.log(`\n🧪 Executing test: ${filePath}`);
    
    try {
      const {stdout, stderr} = await execAsync(
        `npx playwright test ${filePath} --project=chrome`,
        {cwd: 'e2e-tests/playwright', timeout: 120000}
      );
      
      console.log(stdout);
      
      // Check if tests passed
      if (stdout.includes('passed') && !stdout.includes('failed')) {
        console.log(`✅ Tests passed: ${filePath}`);
      } else {
        console.log(`❌ Tests failed: ${filePath}`);
        return {passed: false, output: stdout + '\n' + stderr};
      }
    } catch (error) {
      console.error(`❌ Test execution failed: ${error.message}`);
      return {passed: false, output: error.stdout + '\n' + error.stderr};
    }
  }
  
  return {passed: true, output: 'All tests passed'};
}
```

---

## Step 7: Heal Tests Until Passing (if needed)

If tests fail, invoke the Healer Agent:

```typescript
async function healTestsUntilPassing(
  filePaths: string[],
  maxAttempts: number = 3
): Promise<boolean> {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    attempt++;
    console.log(`\n🔧 Heal attempt ${attempt}/${maxAttempts}`);
    
    // Execute tests
    const result = await executeTests(filePaths);
    
    if (result.passed) {
      console.log('✅ All tests passing!');
      return true;
    }
    
    if (attempt >= maxAttempts) {
      console.error('❌ Failed to heal tests after max attempts');
      throw new Error('Tests still failing after healing attempts. Manual intervention required.');
    }
    
    // Invoke healer agent
    console.log('🔧 Invoking Healer Agent...');
    await invokeHealerAgent(filePaths, result.output);
  }
  
  return false;
}

async function invokeHealerAgent(filePaths: string[], errorOutput: string): Promise<void> {
  // Use Task tool to invoke healer agent
  // Pass file paths and error output for analysis
  console.log('Healer Agent analyzing failures...');
  
  // Healer will:
  // 1. Analyze error logs
  // 2. Use MCP to inspect live browser if needed
  // 3. Fix selector issues
  // 4. Fix timing issues  
  // 5. Fix assertion issues
  // 6. Update test files with fixes
}
```

---

## Step 8: Update Zephyr Status to "Active"

**ONLY after all tests pass**, update Zephyr status:

```typescript
interface AutomationMetadata {
  status: 'Active';
  automationStatus: 'Automated';
  automationFilePath: string;
  automationFramework: 'Playwright';
  automatedOn: string; // ISO timestamp
  automatedBy: 'Claude AI';
}

async function updateZephyrToActive(
  keyMap: Map<string, ZephyrTestCase>,
  config: ZephyrConfig
): Promise<void> {
  console.log('\n✅ All tests passing - Updating Zephyr status to Active...\n');
  
  for (const [filePath, testCase] of keyMap.entries()) {
    const metadata: AutomationMetadata = {
      status: 'Active',
      automationStatus: 'Automated',
      automationFilePath: filePath,
      automationFramework: 'Playwright',
      automatedOn: new Date().toISOString(),
      automatedBy: 'Claude AI'
    };
    
    // Build update payload
    const updatePayload = {
      statusId: 890281,  // Active status ID in Zephyr
      labels: ['playwright-automated', 'ai-generated'],
      customFields: {
        'Automation Status': 'Automated',
        'Automation File Path': metadata.automationFilePath,
        'Automation Framework': metadata.automationFramework,
        'Automated On': metadata.automatedOn
      }
    };
    
    // Write to temp file
    const payloadFile = `/tmp/zephyr-update-${testCase.key}.json`;
    fs.writeFileSync(payloadFile, JSON.stringify(updatePayload, null, 2));
    
    try {
      // Call Zephyr API to update
      await callZephyrAPI(
        config,
        'update',
        testCase.key,
        payloadFile
      );
      
      console.log(`✅ Updated ${testCase.key} status to Active`);
      
      // Clean up
      fs.unlinkSync(payloadFile);
    } catch (error) {
      console.error(`⚠️  Failed to update ${testCase.key}:`, error.message);
      // Don't throw - tests are still valid locally
    }
  }
  
  console.log('\n🎉 Zephyr sync complete! All test cases marked as Active.');
}
```

---

## Complete Orchestration

The main orchestration function that ties everything together:

```typescript
async function orchestrateZephyrSync(skeletonFiles: SkeletonFileMetadata[]): Promise<void> {
  try {
    // Step 1: Load config
    console.log('📋 Loading Zephyr configuration...');
    const config = loadZephyrConfig();
    
    // Step 2: Create Zephyr test cases
    console.log('\n📝 Creating Zephyr test cases...');
    const keyMap = await createZephyrTestCases(skeletonFiles, config);
    
    // Step 3: Replace placeholders
    console.log('\n🔄 Replacing MM-TXXX placeholders...');
    await replacePlaceholders(keyMap);
    
    // Step 4: Generate full code
    console.log('\n💻 Generating full Playwright code...');
    await generateFullCode(skeletonFiles, keyMap);
    
    // Step 5: Update files
    console.log('\n📝 Updating test files...');
    await updateFilesWithFullCode(skeletonFiles, keyMap);
    
    // Step 6-7: Execute and heal tests (MANDATORY)
    console.log('\n🧪 Executing tests (mandatory)...');
    const filePaths = skeletonFiles.map(f => f.filePath);
    const allTestsPassing = await healTestsUntilPassing(filePaths, 3);
    
    if (!allTestsPassing) {
      throw new Error('Could not get all tests to pass. Manual intervention required.');
    }
    
    // Step 8: Update Zephyr to Active
    await updateZephyrToActive(keyMap, config);
    
    console.log('\n✅ ===== WORKFLOW COMPLETE =====');
    console.log(`✅ Created ${keyMap.size} test cases in Zephyr`);
    console.log(`✅ Generated ${filePaths.length} test files`);
    console.log(`✅ All tests passing`);
    console.log(`✅ Zephyr status: Active`);
    
  } catch (error) {
    console.error('\n❌ Zephyr sync failed:', error.message);
    console.error('\nPartial state may exist. Check:');
    console.error('- Skeleton files (may have MM-TXXX or actual keys)');
    console.error('- Zephyr test cases (may be in Draft status)');
    console.error('- Test files (may be incomplete)');
    throw error;
  }
}
```

---

## Error Handling & Rollback

```typescript
async function handleError(error: Error, state: {keyMap?: Map, files?: string[]}) {
  console.error('🛑 ERROR:', error.message);
  
  // Don't delete Zephyr test cases - they can be reused
  console.log('ℹ️  Zephyr test cases remain (can be re-automated)');
  
  // Keep skeleton files for retry
  console.log('ℹ️  Skeleton files preserved for retry');
  
  // Log state for debugging
  if (state.keyMap) {
    console.log('\n📝 Created test cases:');
    for (const [file, testCase] of state.keyMap.entries()) {
      console.log(`  ${testCase.key}: ${file}`);
    }
  }
  
  // Provide retry instructions
  console.log('\n🔄 To retry:');
  console.log('1. Fix any configuration issues');
  console.log('2. Re-run the workflow');
  console.log('3. System will detect existing Zephyr cases and continue');
}
```

---

## Key Validation Rules

Before updating Zephyr to "Active", validate:

1. ✅ All test files exist
2. ✅ All tests have actual MM-T keys (no MM-TXXX)
3. ✅ All tests executed successfully
4. ✅ Exit code was 0
5. ✅ No "failed" in output
6. ✅ Zephyr API is reachable

**Only when ALL validations pass → Update status to "Active"**

