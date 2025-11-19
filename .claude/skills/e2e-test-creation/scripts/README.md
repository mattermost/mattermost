# Zephyr Integration Scripts

This directory contains TypeScript utility scripts for Zephyr test management integration.

## Scripts Overview

### 1. check-test-case.ts
**Purpose**: Validate and check Zephyr test case details

**Usage**:
```bash
npx ts-node scripts/check-test-case.ts MM-T1234
```

**Description**: Fetches and displays test case information from Zephyr to verify connectivity and test case structure.

---

### 2. convert-to-e2e.ts
**Purpose**: Convert manual test cases to E2E Playwright tests

**Usage**:
```bash
npx ts-node scripts/convert-to-e2e.ts MM-T1234
```

**Description**: Takes a Zephyr test case key and generates a complete Playwright E2E test file with full automation code.

**Features**:
- Fetches test case from Zephyr
- Generates test steps if missing
- Creates Playwright test file
- Follows Mattermost patterns

---

### 3. pull-from-zephyr.ts
**Purpose**: Pull test cases from Zephyr for local processing

**Usage**:
```bash
npx ts-node scripts/pull-from-zephyr.ts --folder "E2E Tests/Authentication"
npx ts-node scripts/pull-from-zephyr.ts --key MM-T1234
```

**Description**: Fetches test cases from Zephyr and saves them locally for batch processing or analysis.

**Options**:
- `--folder`: Pull all test cases from a specific folder
- `--key`: Pull a specific test case by key
- `--output`: Specify output directory (default: `.zephyr-cache/`)

---

### 4. push-to-zephyr.ts
**Purpose**: Push test results or updates back to Zephyr

**Usage**:
```bash
npx ts-node scripts/push-to-zephyr.ts --results test-results.json
npx ts-node scripts/push-to-zephyr.ts --update MM-T1234 --status "Automated"
```

**Description**: Updates Zephyr test cases with automation results, status updates, or metadata.

**Options**:
- `--results`: Push test execution results
- `--update`: Update specific test case
- `--status`: Set automation status
- `--file`: Associate automation file path

---

### 5. test-zephyr-pilot.ts
**Purpose**: Test Zephyr API connectivity and configuration

**Usage**:
```bash
npx ts-node scripts/test-zephyr-pilot.ts
```

**Description**: Validates Zephyr configuration and tests API connectivity. Use this first to ensure your credentials and setup are correct.

**Checks**:
- Configuration file exists
- Credentials are valid
- API endpoints are accessible
- Project permissions

---

## Configuration

All scripts require Zephyr configuration in `.claude/settings.local.json`:

```json
{
  "zephyr": {
    "baseUrl": "https://mattermost.atlassian.net",
    "jiraToken": "YOUR_JIRA_PAT",
    "zephyrToken": "YOUR_ZEPHYR_TOKEN",
    "projectKey": "MM",
    "folderId": "28243013"
  }
}
```

## Prerequisites

### 1. Install Dependencies
```bash
npm install @types/node typescript ts-node
```

### 2. Configure Credentials
Create `.claude/settings.local.json` with your Zephyr credentials (see Configuration section above).

### 3. Test Configuration
```bash
npx ts-node scripts/test-zephyr-pilot.ts
```

## Common Workflows

### Workflow 1: Convert Single Test Case
```bash
# Step 1: Check test case exists
npx ts-node scripts/check-test-case.ts MM-T1234

# Step 2: Convert to E2E test
npx ts-node scripts/convert-to-e2e.ts MM-T1234

# Step 3: Run generated test
cd e2e-tests/playwright
npx playwright test specs/functional/auth/test_successful_login.spec.ts
```

### Workflow 2: Batch Convert from Folder
```bash
# Step 1: Pull all test cases from folder
npx ts-node scripts/pull-from-zephyr.ts --folder "E2E Tests/Authentication"

# Step 2: Process each test case
# (Use the output to iterate through test cases)
for key in MM-T1234 MM-T1235 MM-T1236; do
  npx ts-node scripts/convert-to-e2e.ts $key
done
```

### Workflow 3: Push Results Back to Zephyr
```bash
# Step 1: Run tests and capture results
cd e2e-tests/playwright
npx playwright test --reporter=json > results.json

# Step 2: Push results to Zephyr
npx ts-node scripts/push-to-zephyr.ts --results results.json
```

## Script Integration with Workflows

These scripts support the two main workflows:

### Main Workflow (3-Stage Pipeline)
- Used internally by `zephyr-sync` agent
- Creates test cases via API
- Updates with automation metadata

### Automate Existing Workflow
- `check-test-case.ts` - Validate test case
- `convert-to-e2e.ts` - Generate automation
- `push-to-zephyr.ts` - Update with results

## Environment Variables

Alternative to settings file, you can use environment variables:

```bash
export ZEPHYR_BASE_URL="https://mattermost.atlassian.net"
export JIRA_TOKEN="your-token"
export ZEPHYR_TOKEN="your-token"
export PROJECT_KEY="MM"

npx ts-node scripts/check-test-case.ts MM-T1234
```

## Error Handling

### Common Errors

**"Configuration not found"**
```bash
# Solution: Create .claude/settings.local.json
cp .claude/settings.local.json.example .claude/settings.local.json
# Edit with your credentials
```

**"401 Unauthorized"**
```bash
# Solution: Verify tokens are valid
npx ts-node scripts/test-zephyr-pilot.ts
```

**"Test case not found"**
```bash
# Solution: Verify test case exists and you have access
npx ts-node scripts/check-test-case.ts MM-T1234
```

**"Permission denied"**
```bash
# Solution: Ensure your JIRA account has Zephyr permissions
# Contact your JIRA admin to grant access
```

## Development

### Adding New Scripts

1. Create script in `scripts/` directory
2. Follow TypeScript best practices
3. Use shared Zephyr API client
4. Add documentation to this README
5. Add usage examples

### Testing Scripts Locally

```bash
# Run with ts-node
npx ts-node scripts/your-script.ts

# Or compile and run
npx tsc scripts/your-script.ts
node scripts/your-script.js
```

## API Reference

For API details, see:
- [tools/zephyr-api.md](../tools/zephyr-api.md) - Complete API documentation
- [Zephyr Scale API Docs](https://support.smartbear.com/zephyr-scale-cloud/api-docs/)

## Troubleshooting

### Enable Debug Mode
```bash
DEBUG=true npx ts-node scripts/check-test-case.ts MM-T1234
```

### Verbose Output
```bash
VERBOSE=true npx ts-node scripts/convert-to-e2e.ts MM-T1234
```

### Dry Run (No API Calls)
```bash
DRY_RUN=true npx ts-node scripts/push-to-zephyr.ts --update MM-T1234
```

## Support

For issues with these scripts:
1. Check [ZEPHYR_AUTOMATION_SUMMARY.md](../ZEPHYR_AUTOMATION_SUMMARY.md)
2. Review [workflows/README.md](../workflows/README.md)
3. Verify configuration with `test-zephyr-pilot.ts`
4. Check API documentation in [tools/zephyr-api.md](../tools/zephyr-api.md)

## Future Enhancements

Planned script additions:
- `batch-convert.ts` - Bulk conversion from folder
- `sync-status.ts` - Check sync status between local and Zephyr
- `generate-report.ts` - Generate coverage reports
- `cleanup-old-tests.ts` - Archive obsolete test cases
