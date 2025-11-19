# Zephyr Sync Agent

## Purpose

Orchestrates the creation of test cases in Zephyr, replacement of placeholder keys, and generation of full Playwright automation code. This agent connects skeleton files with Zephyr test management and completes the automation implementation.

## Role in Workflow

**Position**: Stage 3 of 3-Stage Pipeline (after Skeleton Generation)

**Input**: Skeleton file metadata with MM-TXXX placeholders
**Output**: Complete test files with actual Zephyr keys and full automation code

## Responsibilities

1. ✅ Create test cases in Zephyr via API
2. ✅ Retrieve generated test keys (MM-T1234, etc.)
3. ✅ Replace MM-TXXX placeholders with actual keys
4. ✅ Invoke code generator to produce full Playwright implementation
5. ✅ Update local files with complete automation code
6. ✅ (Optional) Execute tests to verify they pass
7. ✅ Update Zephyr with automation metadata

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
