# E2E Test Creation - Troubleshooting Guide

## Common Issues and Solutions

This guide documents real challenges encountered and their solutions.

---

## 1. Zephyr API Token Issues

### Problem: "Your token is expired" (401 Error)

**Symptoms:**
```bash
❌ Error: Zephyr API error (401): {"error": "Your token is expired"}
```

**Root Cause:**
- JWT tokens in `.env` file have expiration timestamps
- Common when using `ZEPHYR_API_KEY` which may be old
- Tokens typically expire after 6-12 months

**Solution:**

Check for multiple token variables in `.env`:
```bash
cd e2e-tests/playwright
grep "ZEPHYR" .env
```

**Multiple tokens may exist:**
- `ZEPHYR_API_KEY` - May be expired
- `ZEPHYR_TOKEN` - Often newer/valid
- Both use JWT format

**Quick Fix:**
```javascript
// In your script, check ZEPHYR_TOKEN first
const apiToken = process.env.ZEPHYR_TOKEN || process.env.ZEPHYR_API_KEY || '';
```

**Verify token expiration:**
```javascript
// Decode JWT to check exp timestamp
const jwt = process.env.ZEPHYR_TOKEN;
const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
console.log('Token expires:', new Date(payload.exp * 1000));
```

**Long-term fix:**
1. Go to https://mattermost.atlassian.net
2. Navigate to Zephyr Scale > Settings > API Access Tokens
3. Generate new JWT token
4. Update `ZEPHYR_TOKEN` in `.env`

---

## 2. Custom Fields Validation Error

### Problem: "All custom fields should be present" (400 Error)

**Symptoms:**
```bash
❌ Error: Zephyr API error (400): {
  "errorCode": 400,
  "message": "When custom fields are present in the request body for this endpoint,
   then all custom fields should be present as well..."
}
```

**Root Cause:**
When updating a Zephyr test case with custom fields, the API requires ALL custom fields to be included in the payload, even if you're only changing one field.

**Solution:**

**❌ WRONG - Partial custom fields:**
```javascript
const updatePayload = {
    status: { id: 890281 },
    customFields: {
        Playwright: 'Yes'  // Only one field - will fail!
    }
};
```

**✅ CORRECT - Include all existing custom fields:**
```javascript
// First, fetch existing test case
const existingTestCase = await makeRequest(`/testcases/${testKey}`, 'GET');

// Include ALL existing custom fields
const updatePayload = {
    key: existingTestCase.key,
    id: existingTestCase.id,
    project: existingTestCase.project,
    name: existingTestCase.name,
    status: { id: 890281 },
    priority: existingTestCase.priority,
    labels: existingTestCase.labels,
    customFields: existingTestCase.customFields || {},  // All existing fields!
    objective: existingTestCase.objective,
    precondition: existingTestCase.precondition,
    folder: existingTestCase.folder,
};

await makeRequest(`/testcases/${testKey}`, 'PUT', updatePayload);
```

**Key insight:** Always fetch the test case first, preserve all fields, then update only what's needed.

---

## 3. Custom Field Value Validation Error

### Problem: "No Custom field option for the name Yes"

**Symptoms:**
```bash
❌ Error: Zephyr API error (400): {"errorCode":400,"message":"No Custom field option for the name Yes"}
```

**Root Cause:**
Custom fields in Zephyr have specific allowed values. You can't just set arbitrary strings.

**Solution:**

**Check existing custom field structure:**
```javascript
const testCase = await makeRequest(`/testcases/${testKey}`, 'GET');
console.log('Custom fields:', JSON.stringify(testCase.customFields, null, 2));
```

**Example output:**
```json
{
  "Playwright": null,
  "Authors": "",
  "Priority P1 to P4": null,
  "Detox": null
}
```

**Don't try to set custom field values unless you know the exact allowed options:**
```javascript
// ❌ WRONG - arbitrary value
customFields.Playwright = 'Yes';

// ✅ CORRECT - leave as-is or set to null
customFields.Playwright = null;
```

**Best practice:** Don't modify custom fields unless you have explicit requirements and know the allowed values.

---

## 4. Selector Healing Challenges

### Problem: Test fails with "Timeout waiting for selector"

**Symptoms:**
```bash
TimeoutError: locator.click: Timeout 30000ms exceeded.
  waiting for getByTestId('SomeTestId')
```

**Root Cause:**
- Incorrect `data-testid` value
- Selector doesn't match actual DOM structure
- Element uses different attribute or format

**Solution Strategy:**

**Step 1: Check actual DOM structure**
User often knows the correct selector. When user provides it, trust it:
```javascript
// User said: "the false toggle has sameReviewersForAllTeams_false data test id"
const toggle = page.getByTestId('sameReviewersForAllTeams_false');  // Use exactly this!
```

**Step 2: Run in headed mode for debugging**
```bash
npx playwright test <file> --project=chrome --headed
```

**Step 3: Check for similar working patterns**
Look at existing test files in the same feature area:
```bash
grep -r "sameReviewers" specs/functional/ai-assisted-e2e/
```

**Step 4: Avoid over-engineering**
Don't try complex selector strategies when simple ones work:
```javascript
// ❌ WRONG - over-complicated
const toggle = page
    .locator('text="Same reviewers for all teams:"')
    .locator('..')
    .getByRole('radio', {name: 'False'});

// ✅ CORRECT - simple and direct
const toggle = page.getByTestId('sameReviewersForAllTeams_false');
```

---

## 5. Strict Mode Violations

### Problem: "strict mode violation: locator resolved to 2 elements"

**Symptoms:**
```bash
Error: strict mode violation: locator('div.DataGrid_row').first().getByText('username123')
resolved to 2 elements:
    1) <span id="aria-selection">option username123, selected.</span>
    2) <div class="UserProfilePill">…</div>
```

**Root Cause:**
The same text appears multiple times in different contexts (e.g., dropdown option + selected pill).

**Solution:**

**Scope the locator to the specific context:**
```javascript
// ❌ WRONG - matches both dropdown and pill
await expect(firstDataGridRow.getByText(username)).toBeVisible();

// ✅ CORRECT - scope to UserProfilePill only
await expect(firstDataGridRow.locator('.UserProfilePill').getByText(username, {exact: true})).toBeVisible();
```

**Key techniques:**
1. Use `.locator()` to scope to specific parent element
2. Add `{exact: true}` to match exact text only
3. Use class selectors to target specific components

---

## 6. Test Execution in Wrong Directory

### Problem: "Project chrome not found"

**Symptoms:**
```bash
Error: Project(s) "chrome" not found. Available projects: ""
```

**Root Cause:**
Running `npx playwright test` from wrong directory. Playwright config is in `e2e-tests/playwright/`.

**Solution:**

**Always use absolute paths in bash commands:**
```bash
# ✅ CORRECT - explicit directory change
/bin/bash -c 'cd /path/to/e2e-tests/playwright && npx playwright test <file> --project=chrome'

# ❌ WRONG - relative paths with cd command issues
cd e2e-tests/playwright && npx playwright test <file>
```

**Or use full file paths:**
```bash
cd /path/to/e2e-tests/playwright
npx playwright test specs/functional/ai-assisted/system_console/test.spec.ts --project=chrome
```

---

## 7. Environment Variable Loading

### Problem: Script can't read .env variables

**Symptoms:**
```bash
❌ ZEPHYR_TOKEN environment variable is required
```

**Root Cause:**
`source .env` doesn't export variables by default in scripts.

**Solution:**

**Use export with grep:**
```bash
# ✅ CORRECT - exports variables
export $(grep -v "^#" .env | grep ZEPHYR_TOKEN | xargs)
node script.mjs

# ❌ WRONG - doesn't export
source .env
node script.mjs
```

**Or export specific variables:**
```bash
export ZEPHYR_TOKEN=$(grep ZEPHYR_TOKEN .env | cut -d '=' -f2 | tr -d '"')
node script.mjs
```

**Or use dotenv in Node.js:**
```javascript
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.ZEPHYR_TOKEN;
```

---

## 8. Zephyr Status ID Issues

### Problem: How to find correct status ID for "Active"?

**Solution:**

**Known Zephyr Status IDs:**
- `401946` - Draft (default for new test cases)
- `890281` - Active (for passing automated tests)

**Verify by checking existing test case:**
```bash
curl -X GET "https://api.zephyrscale.smartbear.com/v2/testcases/MM-T5928" \
  -H "Authorization: Bearer $ZEPHYR_TOKEN" \
  | jq '.status'
```

**Update to Active:**
```javascript
const updatePayload = {
    // ... other fields
    status: {
        id: 890281,
        self: 'https://api.zephyrscale.smartbear.com/v2/statuses/890281'
    }
};
```

---

## 9. Test File Path Organization

### Problem: Where to place AI-generated tests?

**Solution:**

**Directory structure:**
```
e2e-tests/playwright/specs/functional/
├── ai-assisted/          # AI-generated tests (use this!)
│   ├── system_console/
│   ├── channels/
│   └── messaging/
└── ai-assisted-e2e/      # Legacy - don't use
```

**Correct path pattern:**
```javascript
const filePath = 'specs/functional/ai-assisted/<category>/<test_name>.spec.ts';

// Examples:
// specs/functional/ai-assisted/system_console/content_flagging_team_specific.spec.ts
// specs/functional/ai-assisted/channels/browse_channels.spec.ts
```

---

## 10. Module Import Errors in Scripts

### Problem: Cannot find module in helper scripts

**Symptoms:**
```bash
TSError: Cannot find module '@mattermost/playwright-lib/zephyr-api'
```

**Root Cause:**
Helper scripts trying to import internal modules that aren't published packages.

**Solution:**

**Use direct file paths instead:**
```javascript
// ❌ WRONG - treats it like npm package
import {ZephyrAPI} from '@mattermost/playwright-lib/zephyr-api';

// ✅ CORRECT - use relative file path
import {ZephyrAPI} from './zephyr-helpers/zephyr-api.ts';
```

**Or use Node.js native imports:**
```javascript
import * as fs from 'fs';
import * as path from 'path';
import {createZephyrAPI} from './zephyr-helpers/zephyr-api.js';
```

---

## Best Practices Learned

### 1. Always Trust User-Provided Selectors

When user explicitly says:
> "the false toggle has `sameReviewersForAllTeams_false` data test id"

Use it directly! Don't try alternative approaches first.

### 2. Fetch Before Update (Zephyr API)

Always GET the test case before PUT to preserve all fields:
```javascript
const existing = await api.get(`/testcases/${key}`);
const updated = {...existing, status: {id: 890281}};
await api.put(`/testcases/${key}`, updated);
```

### 3. Check Multiple Token Variables

Don't assume only one token exists:
```javascript
const token = process.env.ZEPHYR_TOKEN ||
              process.env.ZEPHYR_API_KEY ||
              process.env.ZEPHYR_API_TOKEN || '';
```

### 4. Scope Selectors to Avoid Strict Mode

When dealing with repeated elements, scope to parent:
```javascript
const pill = row.locator('.UserProfilePill').getByText(username);
```

### 5. Use Explicit Directory Changes

Always use full paths in bash scripts:
```bash
/bin/bash -c 'cd /full/path && command'
```

### 6. Verify Test Passes Before Zephyr Update

Never update Zephyr status to "Active" unless tests pass:
```javascript
const result = await runTests();
if (result.passed) {
    await updateZephyrToActive();
}
```

---

## Quick Reference Commands

### Check Zephyr token expiration:
```bash
cd e2e-tests/playwright
node -e "
const jwt = process.env.ZEPHYR_TOKEN;
const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
console.log('Expires:', new Date(payload.exp * 1000));
"
```

### Run test with debugging:
```bash
cd e2e-tests/playwright
npx playwright test <file> --project=chrome --headed --debug
```

### Check test case in Zephyr:
```bash
export ZEPHYR_TOKEN=$(grep ZEPHYR_TOKEN .env | cut -d'=' -f2 | tr -d '"')
curl -X GET "https://api.zephyrscale.smartbear.com/v2/testcases/MM-T5930" \
  -H "Authorization: Bearer $ZEPHYR_TOKEN" | jq
```

### Update Zephyr status to Active:
```javascript
// See update-zephyr-status.mjs example in workflows/
const payload = {
    ...existingTestCase,
    status: { id: 890281 },
    customFields: existingTestCase.customFields
};
await api.put(`/testcases/${key}`, payload);
```

---

## When to Ask for Help

**Ask user when:**
1. Selector doesn't work after 2-3 attempts → User knows the correct one
2. Multiple valid approaches exist → User can decide preference
3. Test fails repeatedly → User may know about known issues
4. Token/credentials invalid → User needs to refresh them

**Don't ask user when:**
1. Standard Playwright patterns → Use existing patterns
2. Zephyr API issues → Check this guide first
3. Directory/path issues → Use full paths
4. Common errors → Apply solutions from this guide

---

## Lessons from Real Implementation

### MM-T5930 Content Flagging Test Case

**Challenge:** Multiple selector and API issues
**Time to complete:** ~30 minutes (with troubleshooting)
**Key learnings:**
1. ZEPHYR_TOKEN was valid, ZEPHYR_API_KEY was expired
2. User-provided selector was correct from the start
3. Strict mode required scoping to `.UserProfilePill`
4. Zephyr custom fields must ALL be included in updates
5. Test passed first time after fixing selectors

**Success metrics:**
- ✅ Test created and passing (3/3 tests)
- ✅ Zephyr case MM-T5930 created and Active
- ✅ All 9 test steps documented
- ✅ Full workflow completed (10/10 steps)

**If starting over, what would change:**
1. Check ZEPHYR_TOKEN first (not ZEPHYR_API_KEY)
2. Trust user-provided selectors immediately
3. Fetch existing test case before any PUT
4. Scope to specific components to avoid strict mode

---

## Update History

- **2025-11-19**: Initial version based on MM-T5930 implementation
- Documented all challenges and solutions from real workflow
- Added Zephyr API troubleshooting
- Added selector healing strategies
