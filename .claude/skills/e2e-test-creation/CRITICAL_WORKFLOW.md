# CRITICAL E2E Test Creation Workflow

## 🚨 THIS WORKFLOW IS MANDATORY 🚨

**DO NOT SKIP ANY STEPS. FOLLOW IN EXACT ORDER.**

---

## The Correct Workflow

### Phase 1: Planning (BEFORE ANY CODE)

#### Step 1: Explore UI with MCP Browser (MANDATORY)
```bash
# Launch MCP planner agent
Task tool with subagent_type: "Plan"
```

**What happens:**
- MCP agent opens browser in headed mode
- Explores the actual Mattermost UI
- Takes screenshots
- Discovers real selectors (data-testid, ARIA roles, etc.)
- Provides timing observations

**DO NOT** proceed until you have:
- ✅ Screenshots of the UI
- ✅ Actual discovered selectors
- ✅ Understanding of the real workflow

#### Step 2: Write Test Plan
- Use REAL selectors from Step 1
- Create 2-4 essential test scenarios
- Get user approval

---

### Phase 2: Implementation (ONE TEST AT A TIME)

**CRITICAL:** Repeat Steps 3-8 for EACH test scenario. Never batch multiple tests.

#### Step 3: Create Zephyr Test Case (Draft Status)

Create a script like this:
```javascript
const testCase = {
    projectKey: 'MM',
    name: 'scenario name from test plan',
    objective: 'what this tests',
    precondition: 'prerequisites',
    status: {
        id: 401946  // DRAFT status
    },
    folder: {
        id: 28243013,  // As specified by user
        type: 'FOLDER'
    },
    customFields: {
        'Priority P1 to P4': 'P1 - Smoke Tests (App testable?)'  // As specified
    },
    labels: ['automated', 'e2e', 'playwright-automated', 'channels'],
    testScript: {
        type: 'PLAIN_TEXT',
        text: 'test steps...'
    }
};

const result = await makeRequest('/testcases', 'POST', testCase);
// Save MM-T number: result.key (e.g., MM-T5931)
```

**Get the MM-T number before writing any code!**

#### Step 4: Write E2E Code for ONE Test Only

Add to spec file:
```typescript
/**
 * @zephyr MM-T5931  // Use the real ID from Step 3
 * @objective Verify user can...
 * @test_steps
 * 1. Step one
 * 2. Step two
 */
test('MM-T5931 test name', {tag: '@channels'}, async ({pw}) => {
    // Implementation for ONE test only
});
```

#### Step 5: Run in Headed Chrome Only

```bash
cd e2e-tests/playwright
npm run test -- <file>.spec.ts --headed --project=chrome --grep "MM-T5931"
```

**NEVER run all browsers on first attempt!**

#### Step 6: Heal if Needed
- Read error messages carefully
- Fix selectors, timing, or logic
- Re-run Step 5
- Repeat until test passes on Chrome

#### Step 7: Verify Test Passes
- Confirm test is green on Chrome
- Check that all assertions pass
- Verify test is stable (run 2-3 times if needed)

#### Step 8: Update Zephyr to Active

```javascript
// Fetch existing test case
const existing = await makeRequest(`/testcases/MM-T5931`, 'GET');

// Update status to Active
const payload = {
    ...existing,
    status: {
        id: 890281,  // ACTIVE status
        self: 'https://api.zephyrscale.smartbear.com/v2/statuses/890281'
    }
};

await makeRequest(`/testcases/MM-T5931`, 'PUT', payload);
```

#### Step 9: Move to Next Test
- If there are more scenarios, go back to Step 3
- Repeat for each test scenario ONE AT A TIME

---

### Phase 3: Final Verification

#### Step 10: Run Full Browser Matrix

After ALL tests pass on Chrome individually:
```bash
npm run test -- <file>.spec.ts --headed
```

This runs on all browsers (chrome, firefox, ipad)

---

## Common Mistakes to AVOID

### ❌ NEVER Do These:

1. **Skip UI exploration**
   - Writing test plan without seeing the UI
   - Guessing selectors

2. **Batch multiple tests**
   - Creating all tests in one go
   - Not waiting for one to pass before moving to next

3. **Wrong test execution**
   - Running all browsers on first attempt
   - Not using --headed mode
   - Not using --project=chrome for initial runs

4. **Zephyr integration errors**
   - Creating test in Active status initially
   - Not setting folder ID
   - Not updating to Active after E2E passes
   - Guessing MM-T numbers

5. **Skipping healing iterations**
   - Not fixing failures properly
   - Moving to next test while current one fails

---

## Zephyr Status IDs Reference

```javascript
// Use these exact IDs:
const ZEPHYR_STATUS = {
    DRAFT: 401946,   // Use when creating test initially
    ACTIVE: 890281   // Use after E2E passes
};

const FOLDER_IDS = {
    AI_ASSISTED_TEST: 28243013  // Common folder for AI-generated tests
};

const PRIORITIES = {
    P1_SMOKE: 'P1 - Smoke Tests (App testable?)',  // String value, not ID!
    P2_CRITICAL: 'P2 - Critical Functionality',
    P3_NORMAL: 'P3 - Normal',
    P4_NICE_TO_HAVE: 'P4 - Nice to Have'
};
```

---

## Test Execution Command Reference

```bash
# Phase 2 - Individual test on Chrome only
npm run test -- <file>.spec.ts --headed --project=chrome --grep "MM-T5931"

# Phase 3 - All tests on all browsers
npm run test -- <file>.spec.ts --headed

# Running multiple specific tests (after all pass on Chrome)
npm run test -- <file>.spec.ts --headed --grep "MM-T5931|MM-T5932"
```

---

## Cleanup After Completion

Once all tests are passing and Active in Zephyr:

```bash
# Delete temporary scripts
rm -f create-*-zephyr.mjs
rm -f update-*-status.mjs
rm -f verify-zephyr-tests.mjs
rm -f *-test-mapping.json
```

Keep only:
- ✅ E2E test spec file
- ✅ Test plan markdown (co-located)

---

## Summary Checklist

For EACH test scenario:
- [ ] UI explored with MCP browser (headed mode, screenshots)
- [ ] Test plan written with real selectors
- [ ] Zephyr test created (Draft status, correct folder ID)
- [ ] Got MM-T number from Zephyr
- [ ] Wrote E2E code with @zephyr annotation
- [ ] Ran with --headed --project=chrome --grep "MM-TXXXX"
- [ ] Healed until test passes on Chrome
- [ ] Verified test is stable
- [ ] Updated Zephyr to Active status
- [ ] Moved to next test (if any)

Final step:
- [ ] Ran full browser matrix on all tests
- [ ] Cleaned up temporary scripts
