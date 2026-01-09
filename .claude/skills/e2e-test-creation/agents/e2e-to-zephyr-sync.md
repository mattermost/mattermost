# E2E to Zephyr Sync Agent (Reverse Workflow)

**Purpose**: Create Zephyr test cases from existing E2E Playwright tests

**Workflow Direction**: E2E Test → Zephyr Test Case (REVERSE)

## When to Use This Agent

Activate this agent when:
- User has existing E2E tests without Zephyr test cases
- User wants to document working E2E tests in Zephyr
- User mentions "create Zephyr test from E2E"
- User provides path to existing test file and asks to create Zephyr test
- User wants to sync E2E tests with Zephyr retroactively

## Agent Capabilities

This agent can:
1. **Parse existing E2E test files** - Extract test metadata, steps, and assertions
2. **Infer test objectives** - Derive test purpose from test names and code
3. **Generate test steps** - Convert code actions/verifications to Zephyr steps
4. **Create Zephyr test cases** - Create new test cases in Zephyr with all metadata
5. **Link bi-directionally** - Add `@zephyr MM-TXXX` tag to E2E test file
6. **Set automation status** - Mark test as "Active" with 'playwright-automated' label

## Workflow Steps

### Step 1: Parse E2E Test File

Extract test information:
- Test name from `test('...')` declaration
- Objective from JSDoc `@objective` or infer from test name
- Precondition from JSDoc `@precondition` (if present)
- Test steps from code comments (`// #` actions, `// *` verifications)
- Category from file path (e.g., channels, messaging, system_console)
- Priority from file path or test name
- Tags from test configuration

### Step 2: Generate Test Steps

Convert E2E test code to Zephyr test steps:

**From Comments** (preferred):
```typescript
// # Click the create channel button
await page.click('[data-testid="create-channel"]');

// * Verify channel is created
await expect(page.locator('[data-testid="new-channel"]')).toBeVisible();
```
→
```
Step 1: Click the create channel button
Expected: Action completes successfully and UI updates accordingly

Step 2: Verify channel is created
Expected: Channel is created
```

**From Code** (fallback when comments are minimal):
- Extract `await` actions (click, fill, press, goto)
- Extract `expect` assertions (toBeVisible, toContainText)
- Infer descriptions from selectors and actions

### Step 3: Create Test Case in Zephyr

Use the Zephyr API to create test case:
```typescript
const result = await zephyrAPI.createTestCaseFromE2EFile({
    testName: parsedTest.testName,
    objective: parsedTest.objective,
    precondition: parsedTest.precondition,
    steps: parsedTest.steps,
    priority: parsedTest.priority,
    tags: parsedTest.tags,
    filePath: parsedTest.filePath,
}, {
    folderId: '28243013', // AI Assisted Test folder
    setActiveStatus: true, // Set to Active since test already exists
});
```

### Step 4: Update E2E Test File

Add `@zephyr` tag and update test name with Zephyr key:

**Before**:
```typescript
test('Should be able to change threads with arrow keys', async ({pw}) => {
    // test code...
});
```

**After**:
```typescript
/**
 * @zephyr MM-T9876
 */
test('MM-T9876 Should be able to change threads with arrow keys', async ({pw}) => {
    // test code...
});
```

### Step 5: Set Automation Metadata

Mark test case as automated in Zephyr:
- Status: "Active" (ID: 890281)
- Label: 'playwright-automated'
- Keep all existing custom fields

## Script Usage

The agent uses the `sync-e2e-to-zephyr.ts` script:

### Basic Usage
```bash
npx ts-node zephyr-helpers/sync-e2e-to-zephyr.ts specs/functional/channels/threads/threads_list.spec.ts
```

### With Options
```bash
# Create in specific folder with Active status
npx ts-node zephyr-helpers/sync-e2e-to-zephyr.ts \
  specs/functional/channels/threads/threads_list.spec.ts \
  --folder-id 28243013 \
  --active

# Dry run (preview only)
npx ts-node zephyr-helpers/sync-e2e-to-zephyr.ts \
  specs/functional/channels/threads/threads_list.spec.ts \
  --dry-run
```

## Example Conversation Flow

### User Request
```
User: "I have an existing E2E test for threads navigation.
Can you create a Zephyr test case for it?
File: specs/functional/channels/threads/threads_list.spec.ts"
```

### Agent Response
```
Agent: I'll create a Zephyr test case from your existing E2E test.

Step 1: Parsing E2E test file...
   ✅ Found 1 test: "Should be able to change threads with arrow keys"

Step 2: Extracted test metadata:
   - Objective: Verify that user can navigate threads using keyboard arrow keys
   - Category: threads
   - Priority: Normal
   - Steps: 14 steps extracted

Step 3: Preview of test steps:
   1. Start some threads, and leave a draft in one of them
      → Action completes successfully
   2. Switch to the threads list
      → Page loads successfully
   3. Press the down arrow to select a thread
      → Keyboard action is processed correctly
   ... and 11 more steps

Should I create this test case in Zephyr? (yes/no)
```

### After User Confirms
```
Agent: Creating test case in Zephyr...

✅ Created test case: MM-T9876
   - Status: Active
   - Label: playwright-automated
   - Steps: 14

✅ Updated E2E test file with @zephyr MM-T9876 tag

Summary:
   ✅ Created: 1 test case
   🔗 View in Zephyr: https://mattermost.atlassian.net/browse/MM-T9876

Next steps:
   1. Review test case in Zephyr Scale
   2. Verify test steps are accurate
   3. Update priority/labels if needed
```

## Parsing Strategy

### Priority Order for Test Information

1. **Objective**:
   - JSDoc `@objective` tag (if present)
   - Infer from test name
   - Fallback: "Verify: [test name]"

2. **Test Steps**:
   - Code comments (`// #` and `// *`) (preferred)
   - Extract from code structure (fallback)
   - Combine actions with assertions

3. **Category**:
   - File path analysis (channels/, messaging/, system_console/)
   - Default: 'functional'

4. **Priority**:
   - Path indicators (/critical/, /smoke/)
   - Test name keywords (critical, smoke)
   - Default: 'Normal'

## Error Handling

### Test Already Linked
```
⏭️  Skipping "test name" - already linked to MM-T1234
```
→ Skip creation, test already has Zephyr key

### Parse Failure
```
❌ Failed to parse test file: [error details]
```
→ Check file syntax, test structure

### API Failure
```
❌ Failed to create test case: [error details]
```
→ Check Zephyr API token, permissions, folder ID

## Best Practices

### For Optimal Results

1. **Add JSDoc Comments**:
   ```typescript
   /**
    * @objective Verify user can navigate threads using keyboard
    * @precondition User has multiple threads in channel
    */
   test('navigates threads with arrow keys', ...)
   ```

2. **Use Action/Verification Comments**:
   ```typescript
   // # Press arrow down key
   await page.keyboard.press('ArrowDown');

   // * Verify thread is selected
   await expect(threadItem).toHaveClass(/selected/);
   ```

3. **Meaningful Test Names**:
   - Good: "Should be able to change threads with arrow keys"
   - Bad: "test1", "it works"

4. **Semantic Selectors**:
   - Prefer `data-testid` attributes
   - Makes step generation more descriptive

## Integration with Main Workflow

This reverse workflow complements the main workflow:

- **Main Workflow**: Zephyr test case → E2E test (create new tests)
- **Reverse Workflow**: E2E test → Zephyr test case (document existing tests)

Both workflows result in:
- Linked E2E test and Zephyr test case
- Bi-directional traceability
- Automation metadata tracked in Zephyr

## Files Used

- `zephyr-helpers/e2e-test-parser.ts` - Parse E2E test files
- `zephyr-helpers/zephyr-api.ts` - Zephyr API integration (createTestCaseFromE2EFile)
- `zephyr-helpers/sync-e2e-to-zephyr.ts` - CLI script for sync
- `zephyr-helpers/zephyr.config.ts` - Zephyr configuration

## Success Criteria

A successful sync includes:
- ✅ Zephyr test case created with correct name and objective
- ✅ Test steps accurately reflect E2E test behavior
- ✅ E2E file updated with `@zephyr` tag
- ✅ Test marked as "Active" with 'playwright-automated' label
- ✅ Bi-directional link established
- ✅ All metadata preserved (priority, tags, category)
