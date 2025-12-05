# Skeleton Generator Agent

## Purpose

Generates `.spec.ts` skeleton files with placeholder test keys (MM-TXXX) based on test plan scenarios. These skeleton files contain complete test documentation (objective, steps) but no automation code yet.

## Role in Workflow

**Position**: Stage 2 of 3-Stage Pipeline (after Planning, before Zephyr Sync)

**Input**: Test plan with scenarios
**Output**: Skeleton `.spec.ts` files with MM-TXXX placeholders

## Responsibilities

1. ✅ Create one `.spec.ts` file per test scenario
2. ✅ Generate JSDoc with `@objective` and `@test steps`
3. ✅ Create test title with "MM-TXXX" placeholder
4. ✅ Leave test body empty with comment for future implementation
5. ✅ Use proper file naming conventions
6. ✅ Place files in correct directory structure
7. ❌ DO NOT generate automation code yet
8. ❌ DO NOT interact with Zephyr API

## Input Format

Test plan from existing planner agent:

```markdown
## Test Scenarios

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

## Output Format

### File Structure

**IMPORTANT**: All AI-generated tests must go in `specs/functional/ai-assisted/{category}/`

```
e2e-tests/playwright/specs/functional/ai-assisted/auth/
├── login_success.spec.ts
└── login_failure.spec.ts
```

### File Content Template

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

## Implementation Logic

### Step 1: Parse Test Plan

```typescript
interface TestScenario {
  name: string;
  objective: string;
  steps: string[];
  category: string; // e.g., 'auth', 'channels', 'messaging'
}

function parseTestPlan(markdown: string): TestScenario[] {
  const scenarios: TestScenario[] = [];

  // Extract each scenario section
  const scenarioPattern = /### Scenario \d+: (.+?)\n\*\*Objective\*\*: (.+?)\n\*\*Test Steps\*\*:\n([\s\S]+?)(?=###|$)/g;

  let match;
  while ((match = scenarioPattern.exec(markdown)) !== null) {
    const [, name, objective, stepsText] = match;
    const steps = stepsText
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.trim());

    // Infer category from test name
    const category = inferCategory(name);

    scenarios.push({ name, objective, steps, category });
  }

  return scenarios;
}

function inferCategory(testName: string): string {
  const lowerName = testName.toLowerCase();

  if (lowerName.includes('login') || lowerName.includes('auth')) return 'auth';
  if (lowerName.includes('channel')) return 'channels';
  if (lowerName.includes('message') || lowerName.includes('post')) return 'messaging';
  if (lowerName.includes('system console')) return 'system_console';

  return 'functional';
}
```

### Step 2: Generate File Path

```typescript
function generateFilePath(scenario: TestScenario): string {
  const baseDir = 'e2e-tests/playwright/specs/functional';

  // Convert scenario name to file name
  const fileName = scenario.name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^test_/, '') // Remove 'test_' prefix if present
    + '.spec.ts';

  return `${baseDir}/${scenario.category}/${fileName}`;
}

// Examples:
// "Test successful login" → "e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts"
// "Create public channel" → "e2e-tests/playwright/specs/functional/channels/create_public_channel.spec.ts"
```

### Step 3: Generate Skeleton File Content

```typescript
function generateSkeletonFile(scenario: TestScenario): string {
  const tag = `@${scenario.category}`;

  const stepsFormatted = scenario.steps
    .map((step, index) => ` *  ${index + 1}. ${step}`)
    .join('\n');

  return `import {test, expect} from '@playwright/test';

/**
 * @objective ${scenario.objective}
 * @test steps
${stepsFormatted}
 */
test('MM-TXXX ${scenario.name}', {tag: '${tag}'}, async ({pw}) => {
    // TODO: Implementation will be generated after Zephyr test case creation
});
`;
}
```

### Step 4: Write Files and Track Metadata

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface SkeletonFileMetadata {
  filePath: string;
  placeholder: string;
  testName: string;
  objective: string;
  steps: string[];
  category: string;
}

async function generateSkeletonFiles(testPlan: string): Promise<SkeletonFileMetadata[]> {
  const scenarios = parseTestPlan(testPlan);
  const metadata: SkeletonFileMetadata[] = [];

  for (const scenario of scenarios) {
    const filePath = generateFilePath(scenario);
    const content = generateSkeletonFile(scenario);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`✓ Created skeleton file: ${filePath}`);

    // Track metadata for next stage
    metadata.push({
      filePath,
      placeholder: 'MM-TXXX',
      testName: scenario.name,
      objective: scenario.objective,
      steps: scenario.steps,
      category: scenario.category
    });
  }

  return metadata;
}
```

## Agent Prompt

When invoked, use this prompt structure:

```
You are the Skeleton Generator Agent for Mattermost E2E test automation.

TASK: Generate skeleton .spec.ts files based on the test plan provided.

INPUT: Test plan markdown with scenarios, objectives, and test steps

OUTPUT REQUIREMENTS:
1. Create ONE .spec.ts file per scenario
2. Include complete JSDoc with @objective and @test steps
3. Use "MM-TXXX" as placeholder in test title
4. Leave test body empty with TODO comment
5. Use proper file naming: lowercase with underscores
6. Place in correct directory: specs/functional/{category}/
7. Infer appropriate tag from category (@auth, @channels, etc.)

DO NOT:
- Generate any automation code
- Interact with Zephyr API
- Run tests

AFTER COMPLETION:
- List all generated files with paths
- Return metadata JSON for next stage
- Ask user: "Should I create Zephyr Test Cases for these scenarios now?"

EXAMPLE OUTPUT:
Generated 2 skeleton files:
1. e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
2. e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts

Metadata: [...]

Should I create Zephyr Test Cases for these scenarios now? (yes/no)
```

## Integration with Existing Skill

### Reuse Planner Agent

```typescript
// Stage 1: Use existing planner
const testPlan = await invokePlannerAgent(feature);

// Stage 2: Generate skeletons (this agent)
const skeletonMetadata = await generateSkeletonFiles(testPlan);

// Stage 3: Wait for user confirmation
const userConfirmed = await askUser(
  "Should I create Zephyr Test Cases for these scenarios now?"
);

if (userConfirmed) {
  // Proceed to Zephyr Sync Agent
  await invokeZephyrSyncAgent(skeletonMetadata);
}
```

## File Naming Conventions

### Pattern
`{feature_description}.spec.ts`

### Examples
- ✅ `successful_login.spec.ts`
- ✅ `create_public_channel.spec.ts`
- ✅ `post_message_in_thread.spec.ts`
- ❌ `test_login.spec.ts` (avoid 'test_' prefix)
- ❌ `LoginTest.spec.ts` (avoid PascalCase)
- ❌ `login-test.spec.ts` (avoid hyphens)

## Directory Placement Logic

```typescript
const categoryMapping = {
  auth: 'specs/functional/auth',
  channels: 'specs/functional/channels',
  messaging: 'specs/functional/messaging',
  system_console: 'specs/functional/system_console',
  playbooks: 'specs/functional/playbooks',
  calls: 'specs/functional/channels/calls',
  default: 'specs/functional'
};

function getDirectoryPath(category: string): string {
  return categoryMapping[category] || categoryMapping.default;
}
```

## Error Handling

```typescript
async function generateSkeletonFiles(testPlan: string): Promise<SkeletonFileMetadata[]> {
  try {
    const scenarios = parseTestPlan(testPlan);

    if (scenarios.length === 0) {
      throw new Error('No scenarios found in test plan');
    }

    const metadata: SkeletonFileMetadata[] = [];
    const errors: string[] = [];

    for (const scenario of scenarios) {
      try {
        const filePath = generateFilePath(scenario);

        // Check if file already exists
        if (fs.existsSync(filePath)) {
          console.warn(`⚠️  File already exists: ${filePath}`);
          // Option 1: Skip
          continue;
          // Option 2: Append timestamp
          // filePath = filePath.replace('.spec.ts', `_${Date.now()}.spec.ts`);
        }

        const content = generateSkeletonFile(scenario);
        const dir = path.dirname(filePath);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');

        metadata.push({
          filePath,
          placeholder: 'MM-TXXX',
          testName: scenario.name,
          objective: scenario.objective,
          steps: scenario.steps,
          category: scenario.category
        });

        console.log(`✓ Created: ${filePath}`);
      } catch (error) {
        errors.push(`Failed to create ${scenario.name}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.error('Errors occurred during generation:');
      errors.forEach(err => console.error(`  - ${err}`));
    }

    return metadata;
  } catch (error) {
    console.error('Fatal error in skeleton generation:', error);
    throw error;
  }
}
```

## Validation Checklist

Before completing, verify:

- ✅ All files created successfully
- ✅ Each file contains valid TypeScript syntax
- ✅ JSDoc includes @objective and @test steps
- ✅ Test title includes "MM-TXXX" placeholder
- ✅ Test body is empty with TODO comment
- ✅ Files placed in correct directories
- ✅ Metadata captured for all files
- ✅ User prompted for Zephyr creation confirmation

## Output Example

```json
{
  "status": "success",
  "filesGenerated": 2,
  "files": [
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
    },
    {
      "filePath": "e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts",
      "placeholder": "MM-TXXX",
      "testName": "Test unsuccessful login",
      "objective": "Verify appropriate error shown for invalid credentials",
      "steps": [
        "Navigate to login page",
        "Enter invalid username and password",
        "Click Login button",
        "Verify error message is displayed"
      ],
      "category": "auth"
    }
  ],
  "nextAction": "Awaiting user confirmation to create Zephyr test cases"
}
```
