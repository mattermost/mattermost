# Zephyr Test Automation - Quick Start Guide

## Overview

This guide helps you get started with Zephyr Test Automation workflows in under 5 minutes.

## Prerequisites

### 1. Zephyr Configuration

Create `.claude/settings.local.json` at the repository root:

```json
{
  "zephyr": {
    "baseUrl": "https://mattermost.atlassian.net",
    "jiraToken": "YOUR_JIRA_PERSONAL_ACCESS_TOKEN",
    "zephyrToken": "YOUR_ZEPHYR_ACCESS_TOKEN",
    "projectKey": "MM",
    "folderId": "28243013"
  }
}
```

### 2. Get Your Credentials

**JIRA Personal Access Token**:
1. Visit: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token → Use as `jiraToken`

**Zephyr Access Token**:
1. Go to Zephyr Scale settings in JIRA
2. Navigate to "API Access Tokens"
3. Generate new token
4. Copy the token → Use as `zephyrToken`

**Project Key**:
- Your JIRA project key (e.g., "MM" for Mattermost)

## Usage

### Workflow 1: Create New Tests with Zephyr Sync

**Use when**: You want to create new E2E tests and automatically sync them with Zephyr.

#### Step 1: Request Test Creation

```
You: Create tests for the login feature
```

#### Step 2: Review Test Plan

Claude will generate a test plan with 1-3 scenarios:
```markdown
## Test Plan: Login Feature

### Scenario 1: Test successful login
**Objective**: Verify user can login with valid credentials
**Test Steps**:
1. Navigate to login page
2. Enter valid username and password
3. Click Login button
4. Verify user is redirected to dashboard

### Scenario 2: Test unsuccessful login
...
```

#### Step 3: Generate Skeleton Files

Claude automatically generates skeleton `.spec.ts` files:
```
Generated 2 skeleton files:
1. e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts
2. e2e-tests/playwright/specs/functional/auth/unsuccessful_login.spec.ts

Should I create Zephyr Test Cases for these scenarios now? (yes/no)
```

#### Step 4: Confirm Zephyr Creation

```
You: yes
```

#### Step 5: Automatic Sync & Code Generation

Claude will:
- ✅ Create test cases in Zephyr (MM-T1234, MM-T1235)
- ✅ Replace placeholders with actual keys
- ✅ Generate full Playwright code
- ✅ Execute tests
- ✅ Update Zephyr with automation metadata

#### Final Result

```
=== Pipeline Complete ===

Summary:
  MM-T1234: specs/functional/auth/successful_login.spec.ts (PASSED)
  MM-T1235: specs/functional/auth/unsuccessful_login.spec.ts (PASSED)
```

### Workflow 2: Automate Existing Zephyr Test

**Use when**: You have an existing Zephyr test case (MM-TXXXX) that needs automation.

#### Step 1: Request Automation

```
You: Automate MM-T1234
```

#### Step 2: Automatic Processing

Claude will:
- ✅ Fetch test case from Zephyr
- ✅ Generate test steps (if missing)
- ✅ Update Zephyr with steps
- ✅ Generate full Playwright code
- ✅ Write automation file
- ✅ Execute test
- ✅ Update Zephyr metadata

#### Final Result

```
=== Automation Complete: MM-T1234 ===

Summary:
  Test Key: MM-T1234
  Test Name: Test successful login
  File: e2e-tests/playwright/specs/functional/auth/test_successful_login.spec.ts
  Status: Passed
```

## Common Commands

### Create tests with Zephyr sync
```
Create tests for [feature name]
Generate E2E tests for [feature name]
```

### Automate existing Zephyr test
```
Automate MM-TXXXX
Generate automation for MM-TXXXX
Create E2E test for MM-TXXXX
```

### Create tests WITHOUT Zephyr sync
```
Create tests for [feature name]
(When prompted: "Create Zephyr Test Cases?")
You: no
```

## File Locations

After automation, find your test files here:

```
e2e-tests/playwright/specs/functional/
├── auth/              # Authentication tests
├── channels/          # Channel tests
├── messaging/         # Messaging tests
├── system_console/    # System console tests
└── [other]/           # Other categories
```

## Verification

### Check Local Files
```bash
cd e2e-tests/playwright
find specs/functional -name "*.spec.ts" | grep MM-T
```

### Run Tests
```bash
cd e2e-tests/playwright
npx playwright test specs/functional/auth/successful_login.spec.ts
```

### Check Zephyr
1. Go to Zephyr Scale in JIRA
2. Search for your test key (MM-T1234)
3. Verify custom fields:
   - Automation Status: "Automated"
   - Automation File: "specs/functional/auth/..."
   - Last Automated: (timestamp)

## Troubleshooting

### Issue: "Zephyr configuration not found"

**Solution**: Create `.claude/settings.local.json` with Zephyr credentials.

### Issue: "401 Unauthorized" when calling Zephyr API

**Solution**:
1. Verify your JIRA token is valid
2. Verify your Zephyr token is valid
3. Check token has proper permissions

### Issue: "Test case MM-TXXXX not found"

**Solution**:
1. Verify test key exists in Zephyr
2. Check you have access to the project
3. Verify project key in settings matches

### Issue: "Test execution failed"

**Note**: Test failures are non-blocking. The automation file is still created successfully.

**To fix**:
1. Review test output for errors
2. Manually run: `npx playwright test <file-path>`
3. Use existing Healer Agent to fix issues

### Issue: Placeholders (MM-TXXX) not replaced

**Solution**:
1. Check Zephyr API successfully created test cases
2. Verify response contained test keys
3. Check placeholder replacer tool ran successfully

## Examples

### Example 1: Complete Workflow (New Tests)

```
You: Create tests for channel creation

Claude: [Generates test plan]
Claude: Generated 2 skeleton files. Create Zephyr Test Cases? (yes/no)

You: yes

Claude:
✓ Created: MM-T5001 - Create public channel
✓ Created: MM-T5002 - Create private channel
✓ All tests passed

Files created:
- specs/functional/channels/create_public_channel.spec.ts
- specs/functional/channels/create_private_channel.spec.ts
```

### Example 2: Automate Existing Test

```
You: Automate MM-T1234

Claude:
✓ Fetched: Test successful login
⚠️  Test steps missing, generating...
✓ Generated 4 test steps
✓ Updated Zephyr with steps
✓ Generated automation code
✓ Created file: specs/functional/auth/test_successful_login.spec.ts
✓ Test passed

Automation complete!
```

### Example 3: Batch Request

```
You: Create tests for:
1. User login
2. User logout
3. Password reset

Claude: [Processes all three scenarios through 3-stage pipeline]
```

## Next Steps

### Learn More

- **Complete Overview**: Read [`ZEPHYR_AUTOMATION_SUMMARY.md`](./ZEPHYR_AUTOMATION_SUMMARY.md)
- **Main Workflow Details**: Read [`workflows/main-workflow.md`](./workflows/main-workflow.md)
- **Automate Existing Details**: Read [`workflows/automate-existing.md`](./workflows/automate-existing.md)
- **Examples**: Browse [`examples/zephyr-automation/`](./examples/zephyr-automation/)

### Advanced Usage

- **Skip Test Execution**: "Automate MM-T1234 but don't run it yet"
- **Comprehensive Tests**: "Create comprehensive tests with edge cases for [feature]"
- **Manual Test Conversion**: Refer to existing manual test sync documentation

## Configuration Reference

### Full Settings Schema

```json
{
  "zephyr": {
    "baseUrl": "https://your-instance.atlassian.net",
    "jiraToken": "ATATT3xFfGF0...",
    "zephyrToken": "eyJ0eXAiOiJKV1...",
    "projectKey": "MM",
    "folderId": "12345"
  }
}
```

### Optional Settings

```json
{
  "zephyr": {
    "baseUrl": "...",
    "jiraToken": "...",
    "zephyrToken": "...",
    "projectKey": "MM",
    "folderId": "12345",
    "defaultFolder": "/E2E Tests",
    "defaultLabels": ["automated", "e2e"],
    "defaultPriority": "Normal",
    "defaultStatus": "Draft"
  }
}
```

## Support

For issues or questions:
1. Check [`ZEPHYR_AUTOMATION_SUMMARY.md`](./ZEPHYR_AUTOMATION_SUMMARY.md) for complete documentation
2. Review workflow-specific docs in [`workflows/`](./workflows/)
3. Check examples in [`examples/zephyr-automation/`](./examples/zephyr-automation/)

## Summary

Two simple commands cover all scenarios:

1. **New tests with Zephyr sync**:
   ```
   Create tests for [feature]
   → Confirm: yes
   ```

2. **Automate existing test**:
   ```
   Automate MM-TXXXX
   ```

That's it! You're ready to automate tests with Zephyr integration.
