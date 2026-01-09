# E2E Test Automation Workflow

## Overview
When a user says **"Automate MM-TXXX"**, follow this complete workflow to automate the test case.

## Prerequisites
- `ZEPHYR_TOKEN` or `ZEPHYR_API_TOKEN` set in `e2e-tests/playwright/.env`
- Zephyr test case exists and is in Draft or Active status
- Mattermost server is running locally

## Complete Workflow

### Step 1: Fetch Test Case from Zephyr
```bash
cd e2e-tests/playwright
npx ts-node zephyr-helpers/zephyr-api.ts get MM-TXXX
```

This returns:
- Test case name
- Priority
- Status
- Test steps
- Custom fields

### Step 2: Search Codebase for Patterns
Search for existing similar tests to understand patterns and selectors:
```bash
# Example: Search for thread/reply tests
grep -r "reply" e2e-tests/playwright/specs/functional/channels/
```

### Step 3: Write Test Plan
- Create 2-4 essential test scenarios
- Focus on business-critical flows only
- Document expected selectors and interactions
- Get user approval if needed

### Step 4: Write E2E Test (ONE at a time)
**CRITICAL: Only write ONE test at a time**

Location: `e2e-tests/playwright/specs/functional/ai-assisted/{category}/`

Example:
```typescript
/**
 * @zephyr MM-T3125
 * @objective Verify reply functionality in GM threads
 * @test_steps
 * 1. User in GM posts a message
 * 2. User clicks Reply arrow
 * 3. User sees RHS open with reply box
 * 4. User types reply and sends
 */
test('MM-T3125 reply in existing GM', {tag: '@channels'}, async ({pw}) => {
    // Test implementation
});
```

### Step 5: Run Test in Headed Chrome Only
```bash
cd e2e-tests/playwright
npm run test -- test_name.spec.ts --headed --project=chrome --grep "MM-TXXX"
```

**Why Chrome only first?**
- Faster feedback loop
- Easier to debug with visible browser
- Most common browser environment
- Run other browsers only after Chrome passes

### Step 6: Heal Test if Fails
If test fails:
1. Analyze error message and screenshot
2. Fix selectors or timing issues
3. Re-run test
4. Repeat until test passes

Common fixes:
- Add explicit waits: `await element.toBeVisible({timeout: 10000})`
- Use more specific selectors: `getByTestId()` > `getByText()`
- Wait for API calls: `await page.waitForResponse()`
- Handle async operations: `await page.waitForLoadState('networkidle')`

### Step 7: Verify Test Passes
Ensure:
- ✅ Test passes consistently (run 2-3 times)
- ✅ No flaky behavior
- ✅ Proper assertions in place
- ✅ Clean test output

### Step 8: Update Zephyr to Active
```bash
cd e2e-tests/playwright
npx ts-node zephyr-helpers/update-test-status.ts MM-TXXX specs/path/to/test.spec.ts
```

This script:
- Fetches current test case details
- Updates status to **Active** (890281)
- Adds `playwright-automated` label
- Preserves all custom fields
- Adds automation metadata

Expected output:
```
📝 Updating MM-TXXX to Active status...
✅ Successfully updated MM-TXXX to Active
   File: specs/path/to/test.spec.ts
```

### Step 9: Run Full Browser Matrix (Optional)
After Chrome passes, optionally run all browsers:
```bash
cd e2e-tests/playwright
npm run test -- test_name.spec.ts --headed
```

This runs on: chrome, firefox, ipad

## Helper Scripts Reference

### Get Test Case
```bash
cd e2e-tests/playwright
npx ts-node zephyr-helpers/zephyr-api.ts get MM-TXXX
```

### Update Test Status
```bash
cd e2e-tests/playwright
npx ts-node zephyr-helpers/update-test-status.ts MM-TXXX specs/path/to/test.spec.ts
```

### Update Custom Fields
Located in `e2e-tests/playwright/zephyr-helpers/zephyr-api.ts`:
```typescript
const api = new ZephyrAPI();
await api.updateCustomFields('MM-TXXX', {
    'Playwright': 'Automated',
    'Authors': 'Claude Code'
});
```

## Environment Variables

Required in `e2e-tests/playwright/.env`:
```bash
# Zephyr API Token (either name works)
ZEPHYR_TOKEN=your_token_here
# or
ZEPHYR_API_TOKEN=your_token_here

# Optional overrides
ZEPHYR_API_BASE_URL=https://api.zephyrscale.smartbear.com/v2
ZEPHYR_PROJECT_KEY=MM
```

## Zephyr Status IDs

Reference for manual API calls:
- **Draft**: 401946 (initial status when creating test)
- **Active**: 890281 (test is automated and active)
- **Approved**: 401947
- **Deprecated**: 401948

## Common Issues

### Token Errors
```
Error: The token was expected to have 3 parts, but got 0
```
**Fix**: Ensure `ZEPHYR_TOKEN` or `ZEPHYR_API_TOKEN` is set in `e2e-tests/playwright/.env`

### Custom Fields Error
```
Error: When custom fields are present, all custom fields should be present
```
**Fix**: Use the helper script which automatically includes all required fields

### Test Case Not Found
```
Error: 404 Not Found
```
**Fix**: Verify the test case key is correct (e.g., `MM-T3125`)

## Tips for Success

1. **ONE test at a time**: Never batch multiple tests
2. **Chrome first**: Always run Chrome headed before other browsers
3. **Use helpers**: Leverage existing `zephyr-helpers/` scripts
4. **Search patterns**: Look for similar tests in codebase first
5. **Heal immediately**: Fix failures right away, don't accumulate
6. **Update Zephyr**: Always update to Active after E2E passes
7. **Document clearly**: Add clear JSDoc with `@zephyr` tag

## Example Complete Session

```bash
# 1. Get test case
cd e2e-tests/playwright
npx ts-node zephyr-helpers/zephyr-api.ts get MM-T3125

# 2. Search for patterns
grep -r "reply" specs/functional/channels/

# 3. Write test (in editor)
# specs/functional/ai-assisted/channels/group_message_reply.spec.ts

# 4. Run test
npm run test -- group_message_reply.spec.ts --headed --project=chrome --grep "MM-T3125"

# 5. If fails, heal and re-run

# 6. Update Zephyr
npx ts-node zephyr-helpers/update-test-status.ts MM-T3125 specs/functional/ai-assisted/channels/group_message_reply.spec.ts

# ✅ Done!
```

## Next Steps

After automation:
1. ✅ Test is in Active status in Zephyr
2. ✅ Test runs in CI/CD pipeline
3. ✅ Test appears in automation reports
4. ✅ Future changes to feature will trigger this test

---

**Remember**: This workflow is designed to be systematic and repeatable. Follow each step carefully to ensure high-quality automated tests.
