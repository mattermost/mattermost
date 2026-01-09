# STRICT E2E Test Creation Workflow

## ⚠️ THIS IS THE ONLY CORRECT WAY TO CREATE E2E TESTS

**Violating this workflow will result in:**
- ❌ Broken Zephyr integration
- ❌ Fake test IDs that can't be tracked
- ❌ Wasted time and AI costs
- ❌ Tests that don't match requirements

---

## The 10 Mandatory Steps

### Phase 1: Planning (Steps 1-2)

#### Step 1: Create Test Plan
**What to do:**
```markdown
Create a markdown document outlining:
- Feature being tested
- Test scenarios (2-3 core flows)
- Prerequisites
- Expected outcomes
```

**Example:**
```markdown
# Test Plan: Team-Specific Content Flagging

## Feature
Allow admins to configure different content reviewers per team

## Test Scenarios
1. **Configure team-specific reviewers**
   - Enable team-specific mode
   - Add reviewers for Team A
   - Add different reviewers for Team B
   - Verify settings persist

2. **Bulk disable all teams**
   - Configure multiple teams
   - Use "Disable for all teams" button
   - Verify all toggles are off

3. **Switch between modes**
   - Start with common reviewers
   - Switch to team-specific
   - Verify UI updates correctly
```

**Action:**
Present plan to user and ask: **"Does this test plan look good? Should I proceed with creating skeleton files?"**

**WAIT for user approval before proceeding.**

---

#### Step 2: Create Skeleton Files
**What to do:**
Create `.spec.ts` file with **ONLY** test structure using `MM-TXXX` placeholders.

**Example:**
```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can configure team-specific content reviewers
 * @test steps
 *  1. Login as admin user
 *  2. Navigate to System Console > Content Flagging
 *  3. Enable team-specific reviewer mode
 *  4. Configure reviewers for Team A
 *  5. Configure reviewers for Team B
 *  6. Save and verify persistence
 */
test('MM-TXXX Configure team-specific content reviewers', async ({pw}) => {});

/**
 * @objective Verify admin can disable content flagging for all teams at once
 * @test steps
 *  1. Login as admin user
 *  2. Configure reviewers for multiple teams
 *  3. Click "Disable for all teams" button
 *  4. Verify all teams are disabled
 */
test('MM-TXXX Disable content flagging for all teams', async ({pw}) => {});

/**
 * @objective Verify switching between common and team-specific modes
 * @test steps
 *  1. Start with common reviewers mode
 *  2. Add common reviewers
 *  3. Switch to team-specific mode
 *  4. Verify UI updates correctly
 */
test('MM-TXXX Switch between reviewer modes', async ({pw}) => {});
```

**File location:**
```
e2e-tests/playwright/specs/functional/ai-assisted/system_console/content_flagging_team_specific.spec.ts
```

**Action:**
Show skeleton file to user and ask: **"Should I create Zephyr test cases for these tests?"**

**WAIT for user response.**

---

### Phase 2: Zephyr Creation (Steps 3-6)

#### Step 3: Ask User About Zephyr
**Action:**
Ask: **"Should I create Zephyr test cases for these scenarios?"**

**Options:**
- If user says **"No"** → Skip to Phase 3 (keep MM-TXXX placeholders)
- If user says **"Yes"** → Proceed to Step 4

---

#### Step 4: Create Zephyr Test Cases (Draft Status)
**What to do:**
Use Zephyr API to create test cases with status **"Draft"**.

**Example script:**
```bash
cd e2e-tests/playwright
npx ts-node zephyr-helpers/create-test-cases.ts \
  --file specs/functional/ai-assisted/system_console/content_flagging_team_specific.spec.ts
```

**Expected output:**
```
Created Zephyr test cases:
- MM-T5929: Configure team-specific content reviewers (Draft)
- MM-T5930: Disable content flagging for all teams (Draft)
- MM-T5931: Switch between reviewer modes (Draft)
```

**IMPORTANT:**
- Test cases are in **"Draft"** status
- They will NOT be set to "Active" until tests pass

---

#### Step 5: Get Real MM-T Numbers
**What to do:**
Extract the real MM-T numbers returned from Zephyr API.

**Example:**
```typescript
const testCaseIds = {
  'MM-TXXX Configure team-specific': 'MM-T5929',
  'MM-TXXX Disable content flagging': 'MM-T5930',
  'MM-TXXX Switch between modes': 'MM-T5931',
};
```

---

#### Step 6: Replace Placeholders
**What to do:**
Replace `MM-TXXX` with real MM-T numbers in the skeleton file.

**Before:**
```typescript
test('MM-TXXX Configure team-specific content reviewers', async ({pw}) => {});
```

**After:**
```typescript
test('MM-T5929 Configure team-specific content reviewers', async ({pw}) => {});
```

**Action:**
Run replacement script:
```bash
cd e2e-tests/playwright
npx ts-node zephyr-helpers/replace-placeholders.ts \
  --file specs/functional/ai-assisted/system_console/content_flagging_team_specific.spec.ts \
  --mapping '{"MM-TXXX Configure team-specific":"MM-T5929","MM-TXXX Disable content flagging":"MM-T5930","MM-TXXX Switch between modes":"MM-T5931"}'
```

---

### Phase 3: Implementation & Validation (Steps 7-10)

#### Step 7: Implement FIRST Test ONLY
**What to do:**
Write the COMPLETE implementation for **ONLY** the first test.

**Example:**
```typescript
test('MM-T5929 Configure team-specific content reviewers', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Create test teams
    const team1 = await adminClient.createTeam(await pw.random.team());
    const team2 = await adminClient.createTeam(await pw.random.team());

    // ... full implementation ...
});

// LEAVE OTHER TESTS AS EMPTY SKELETONS
test('MM-T5930 Disable content flagging for all teams', async ({pw}) => {});
test('MM-T5931 Switch between reviewer modes', async ({pw}) => {});
```

**DO NOT implement all tests at once!**

---

#### Step 8: Run FIRST Test in Headed Chrome Mode
**What to do:**
Run **ONLY** the first test in headed mode on Chrome browser.

**Command:**
```bash
cd e2e-tests/playwright
npx playwright test specs/functional/ai-assisted/system_console/content_flagging_team_specific.spec.ts \
  --headed \
  --project=chrome \
  --grep="MM-T5929"
```

**Flags explained:**
- `--headed` → Opens visible browser (you can see what's happening)
- `--project=chrome` → Runs on Chrome only (not Firefox, iPad, etc.)
- `--grep="MM-T5929"` → Runs ONLY this specific test

**What to observe:**
- Watch the browser perform actions
- Check if selectors work correctly
- Verify timing and waits are appropriate

**Expected outcome:**
```
Running 1 test using 1 worker

✓ [chrome] › content_flagging_team_specific.spec.ts:19:5 › MM-T5929 Configure team-specific content reviewers (12.3s)

1 passed (12.3s)
```

---

#### Step 9: Update Zephyr to Active (IF Test Passes)
**What to do:**

**IF test passes:**
```bash
# Update Zephyr status to "Active"
npx ts-node zephyr-helpers/update-test-status.ts \
  --test-id MM-T5929 \
  --status Active
```

**IF test fails:**
1. Analyze the failure
2. Fix the test code
3. Re-run: `npx playwright test ... --grep="MM-T5929"`
4. Maximum 3 attempts
5. If still failing after 3 attempts, report to user

**DO NOT mark as Active if test didn't pass!**

---

#### Step 10: Repeat for Next Test
**What to do:**
Go back to Step 7 and implement the NEXT test.

**Example flow:**
```
Step 7: Implement MM-T5930 (second test)
Step 8: Run with --grep="MM-T5930"
Step 9: Update MM-T5930 to Active (if passed)
Step 10: Move to MM-T5931 (third test)
```

**Continue until all tests are implemented and passing.**

---

## Common Mistakes to Avoid

### ❌ Mistake #1: Using Fake MM-T Numbers
```typescript
// WRONG - These numbers don't exist in Zephyr
test('MM-T5929 Configure...', async ({pw}) => {});
test('MM-T5930 Disable...', async ({pw}) => {});
```

**Why it's wrong:**
- You never created these test cases in Zephyr
- Numbers are made up
- Can't track test results

**Fix:**
Use `MM-TXXX` until you get real numbers from Zephyr API.

---

### ❌ Mistake #2: Running All Tests at Once
```bash
# WRONG
npx playwright test content_flagging_team_specific.spec.ts
```

**Why it's wrong:**
- Runs on all browsers (Chrome, Firefox, iPad)
- Runs all tests at once
- Can't observe individual test behavior
- Wastes time if first test fails

**Fix:**
```bash
# CORRECT - One test at a time, headed mode, Chrome only
npx playwright test content_flagging_team_specific.spec.ts \
  --headed \
  --project=chrome \
  --grep="MM-T5929"
```

---

### ❌ Mistake #3: Implementing All Tests at Once
```typescript
// WRONG - All tests implemented before any are validated
test('MM-T5929...', async ({pw}) => {
  // 100 lines of code
});

test('MM-T5930...', async ({pw}) => {
  // 100 lines of code
});

test('MM-T5931...', async ({pw}) => {
  // 100 lines of code
});
```

**Why it's wrong:**
- If first test has issues, all tests might have same issues
- Waste time implementing code that needs to be changed
- Can't update Zephyr incrementally

**Fix:**
Implement one test, validate it passes, then move to next.

---

### ❌ Mistake #4: Skipping User Approval
```
User: "Create E2E tests for feature X"
AI: *immediately writes 300 lines of test code*
User: "Wait, I don't need test scenario #3"
AI: *wasted time and tokens*
```

**Why it's wrong:**
- User might not want all test scenarios
- User might want different test scenarios
- Costs time and money to rewrite

**Fix:**
Always show test plan first, get approval, then proceed.

---

### ❌ Mistake #5: Setting Zephyr to Active Before Test Passes
```bash
# WRONG sequence
1. Create Zephyr test case
2. Set status to "Active"
3. Run test
4. Test fails ← Now you have an "Active" test that doesn't work!
```

**Why it's wrong:**
- Zephyr shows test as "Active" but it's actually broken
- Misleads QA team about test coverage

**Fix:**
1. Create Zephyr test case (status: **Draft**)
2. Run test
3. IF passes → Set status to **Active**
4. IF fails → Fix and retry

---

## Quick Reference

### When User Says: "Create E2E tests for [feature]"

```
Step 1: Create test plan → "Does this plan look good?"
        ↓ (wait for approval)
Step 2: Create skeleton files → "Should I create Zephyr test cases?"
        ↓ (wait for response)
Step 3: If yes, create Zephyr cases (Draft status)
        ↓
Step 4: Get real MM-T numbers from Zephyr
        ↓
Step 5: Replace MM-TXXX with real numbers
        ↓
Step 6: Implement FIRST test only
        ↓
Step 7: Run: npx playwright test ... --headed --project=chrome --grep="MM-T5929"
        ↓
Step 8: IF pass → Update Zephyr to Active
        IF fail → Fix and retry (max 3 times)
        ↓
Step 9: Implement NEXT test
        ↓
Step 10: Repeat until all tests pass
```

### Test Run Commands

```bash
# Run ONE test, headed mode, Chrome only
npx playwright test FILE.spec.ts --headed --project=chrome --grep="MM-T5929"

# View test results
npx playwright show-report results/reporter

# Debug test
npx playwright test FILE.spec.ts --headed --project=chrome --grep="MM-T5929" --debug
```

### Zephyr Commands

```bash
# Create test cases
npx ts-node zephyr-helpers/create-test-cases.ts --file FILE.spec.ts

# Replace placeholders
npx ts-node zephyr-helpers/replace-placeholders.ts --file FILE.spec.ts --mapping '{...}'

# Update test status
npx ts-node zephyr-helpers/update-test-status.ts --test-id MM-T5929 --status Active
```

---

## Summary

✅ **DO:**
- Create test plan first
- Get user approval at each phase
- Use MM-TXXX placeholders
- Create Zephyr cases in Draft status
- Implement one test at a time
- Run tests in headed Chrome mode with --grep
- Update Zephyr to Active only after test passes

❌ **DON'T:**
- Use fake MM-T numbers (MM-T5929, etc.)
- Run all tests at once
- Implement all tests before validating first
- Skip user approval
- Set Zephyr to Active before test passes

**Following this workflow saves time, cost, and ensures quality!**
