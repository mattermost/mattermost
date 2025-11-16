# Manual Test Management Integration

This guide explains how the manual test management system integrates with E2E test automation.

## Two Repository System

Mattermost test management uses two separate repositories:

### 1. mattermost-test-management Repository
**Purpose:** Manual test case definitions and test management metadata

**Location:** `/Users/yasserkhan/Documents/mattermost/mattermost-test-management/`

**Contains:**
- Manual test cases (markdown files)
- Test metadata (folders, priorities, statuses)
- Test case indexes and mappings
- Zephyr integration data

### 2. mattermost Repository
**Purpose:** Main application code and E2E tests

**Location:** `/Users/yasserkhan/Documents/mattermost/mattermost/`

**Contains:**
- Application source code (webapp/, server/)
- E2E Playwright tests (e2e-tests/playwright/specs/)
- Test infrastructure and page objects

## Data Flow

### Current Workflow (Before Automation)
```
1. QA writes manual test → mattermost-test-management/data/test-cases/MM-TXXX.md
2. Manual test gets Zephyr key → MM-TXXX
3. Dev works on feature → mattermost/webapp/...
4. Feature ships → ❌ No E2E coverage
5. Later, dev needs to add E2E:
   a. Submit PR to mattermost-test-management
   b. Get MM-TXXX key assigned
   c. Write E2E test in mattermost/e2e-tests/playwright/
   d. Include MM-TXXX in test title
```

### New Workflow (With Automation)
```
1. QA writes manual test → mattermost-test-management/data/test-cases/MM-TXXX.md
2. Manual test gets Zephyr key → MM-TXXX
3. Dev works on feature → mattermost/webapp/...
4. @gap-analyzer detects missing E2E → "MM-TXXX has no E2E coverage"
5. @manual-converter auto-converts → E2E test created with MM-TXXX link
6. Dev reviews and runs test → Feature ships with E2E coverage ✅
```

## Manual Test Structure

### File Organization
```
mattermost-test-management/
├── data/
│   ├── test-cases/              # Test case markdown files
│   │   ├── calls/
│   │   │   ├── MM-T5382.md
│   │   │   ├── MM-T4841.md
│   │   │   └── ...
│   │   ├── channels/
│   │   │   ├── messaging/
│   │   │   ├── settings/
│   │   │   └── ...
│   │   ├── system-console/
│   │   └── ...
│   ├── key-and-path.json        # Maps keys to paths
│   ├── folders.json             # Folder hierarchy
│   ├── priorities.json          # Priority definitions
│   ├── statuses.json            # Status values
│   └── components.json          # Component definitions
└── src/                         # Management scripts
    ├── get_test_cases.ts
    ├── get_folders.ts
    ├── index_test_cases.ts
    └── ...
```

### Test Case Format
```markdown
---
# Required fields
name: "Test name"
status: Active|Deprecated
priority: Normal|Low|High|Critical
folder: Feature Area
priority_p1_to_p4: P1|P2|P3|P4
key: MM-TXXX
id: 12345678

# Optional fields
component: null
location: null
tags: []
labels: []

# Automation status
playwright: null|Automated|In Progress
cypress: null
detox: null

# Timestamps
created_on: "2023-01-15T10:00:00Z"
last_updated: "2024-01-20T15:30:00Z"
---

## MM-TXXX: Test Title

**Step 1**
Description
1. Substep 1
2. Substep 2
   - Expected result

**Step 2**
...

**Expected**
Overall expected outcome
```

### Key Files Explained

#### key-and-path.json
Maps test keys to feature paths:
```json
[
  {"key": "MM-T5382", "path": "calls", "id": 79351388},
  {"key": "MM-T1234", "path": "channels/messaging", "id": 12345678}
]
```

**Usage:**
- Determine feature area for test
- Map to E2E test directory
- Link tests across repositories

#### folders.json
Defines folder hierarchy:
```json
[
  {
    "id": 12345,
    "name": "Calls",
    "parent_id": null,
    "type": "folder"
  },
  {
    "id": 67890,
    "name": "Screen Sharing",
    "parent_id": 12345,
    "type": "folder"
  }
]
```

**Usage:**
- Understand feature organization
- Group tests by feature
- Navigate test hierarchy

#### priorities.json
Priority level definitions:
```json
[
  {"name": "Critical", "id": 1},
  {"name": "High", "id": 2},
  {"name": "Normal", "id": 3},
  {"name": "Low", "id": 4}
]
```

**Usage:**
- Prioritize automation efforts
- Filter high-priority gaps
- Report on coverage by priority

## E2E Test Structure

### File Organization
```
mattermost/e2e-tests/playwright/
├── specs/
│   ├── functional/              # Functional E2E tests
│   │   ├── calls/
│   │   │   ├── profile_call.spec.ts
│   │   │   └── ...
│   │   ├── channels/
│   │   │   ├── messaging/
│   │   │   ├── settings/
│   │   │   └── ...
│   │   ├── system_console/
│   │   └── ...
│   ├── visual/                  # Visual regression
│   ├── accessibility/           # Accessibility
│   └── client/                  # Client API
├── lib/                         # Test infrastructure
│   ├── src/
│   │   ├── ui/pages/           # Page objects
│   │   ├── ui/components/      # Component objects
│   │   └── ...
│   └── package.json
└── .ai/                         # Claude skills & agents
    ├── agents/
    │   ├── playwright-planner.md
    │   ├── playwright-generator.md
    │   ├── playwright-healer.md
    │   ├── gap-analyzer.md
    │   ├── manual-converter.md
    │   └── coverage-reporter.md
    └── skills/
        ├── e2e-test-creation/
        └── manual-test-sync/
```

### Test Format
```typescript
import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Clear description of what test verifies
 *
 * @precondition
 * Special setup required (if any)
 */
test('MM-TXXX descriptive test title', {tag: '@feature'}, async ({pw}) => {
    // Test implementation
});
```

## Integration Points

### 1. Test Key Linkage

**Purpose:** Maintain traceability between manual and E2E tests

**How it works:**
- Manual test has unique key: `MM-T5382`
- E2E test includes key in title: `test('MM-T5382 call from profile...`
- Gap analyzer matches tests by key
- Coverage reports show linkage

**Example:**
```
Manual: mattermost-test-management/data/test-cases/calls/MM-T5382.md
    ↕ (linked by key)
E2E: mattermost/e2e-tests/playwright/specs/functional/calls/profile_call.spec.ts
```

### 2. Directory Mapping

**Purpose:** Organize E2E tests to match manual test structure

**How it works:**
- Manual test has `path` in key-and-path.json
- E2E test placed in corresponding directory
- Makes tests easy to find

**Mapping table:**
```
Manual Path              → E2E Path
──────────────────────────────────────────────────────────
calls                    → specs/functional/calls/
channels/messaging       → specs/functional/channels/messaging/
channels/settings        → specs/functional/channels/settings/
system-console/users     → specs/functional/system_console/users/
authentication           → specs/functional/authentication/
search                   → specs/functional/search/
notifications            → specs/functional/notifications/
plugins                  → specs/functional/plugins/
```

### 3. Automation Status

**Purpose:** Track which manual tests have E2E coverage

**How it works:**
- Manual test has `playwright` field in frontmatter
- Values: `null` (no automation), `Automated`, `In Progress`
- Update field when E2E test is created
- Gap analyzer respects this field

**Workflow:**
```
1. QA creates manual test → playwright: null
2. Dev converts to E2E → playwright: In Progress
3. E2E test passes and merges → playwright: Automated
4. Future gap analyses skip this test
```

### 4. Priority Alignment

**Purpose:** Automate high-priority tests first

**How it works:**
- Manual test has `priority_p1_to_p4` field
- Gap analyzer filters by priority
- Converter prioritizes P1/P2 tests
- Coverage reports highlight priority gaps

**Priority levels:**
- **P1:** Critical functionality, must work
- **P2:** Core features, high importance
- **P3:** Nice-to-have, standard priority
- **P4:** Low priority, edge cases

## Reading Manual Tests

### Using Read Tool
```typescript
// Read manual test file
const content = await read(
  '/Users/yasserkhan/Documents/mattermost/mattermost-test-management/data/test-cases/calls/MM-T5382.md'
);

// Parse YAML frontmatter
const frontmatterRegex = /^---\n([\s\S]+?)\n---/;
const match = content.match(frontmatterRegex);
const frontmatter = yaml.parse(match[1]);

console.log(`Test key: ${frontmatter.key}`);
console.log(`Priority: ${frontmatter.priority_p1_to_p4}`);
console.log(`Status: ${frontmatter.status}`);
console.log(`Automation: ${frontmatter.playwright || 'Not automated'}`);

// Parse test body
const body = content.replace(frontmatterRegex, '').trim();
```

### Using key-and-path.json
```typescript
// Load mapping file
const keyPath = await read(
  '/Users/yasserkhan/Documents/mattermost/mattermost-test-management/data/key-and-path.json'
);
const mapping = JSON.parse(keyPath);

// Find test path
const testInfo = mapping.find(m => m.key === 'MM-T5382');
console.log(`Path: ${testInfo.path}`); // "calls"

// Map to E2E directory
const e2eDir = `specs/functional/${testInfo.path}/`;
console.log(`E2E directory: ${e2eDir}`); // "specs/functional/calls/"
```

## Scanning E2E Tests

### Using Grep Tool
```typescript
// Find all E2E tests with MM-T keys
const results = await grep({
  pattern: 'MM-T\\d+',
  path: 'specs',
  glob: '**/*.spec.ts',
  output_mode: 'content'
});

// Parse results
const testKeys = new Set();
for (const line of results.split('\n')) {
  const match = line.match(/MM-T(\d+)/);
  if (match) {
    testKeys.add(`MM-T${match[1]}`);
  }
}

console.log(`Found ${testKeys.size} E2E tests with keys`);
```

### Building Coverage Map
```typescript
// Create coverage map
const coverage = new Map();

// Load all manual tests
for (const file of findManualTests()) {
  const test = parseManualTest(file);
  coverage.set(test.key, {
    manual: test,
    e2e: null
  });
}

// Match with E2E tests
for (const [key, file] of findE2ETests()) {
  if (coverage.has(key)) {
    coverage.get(key).e2e = file;
  }
}

// Report coverage
const total = coverage.size;
const automated = Array.from(coverage.values()).filter(t => t.e2e).length;
console.log(`Coverage: ${automated}/${total} (${(automated/total*100).toFixed(1)}%)`);
```

## Updating Manual Tests

After converting to E2E, update the manual test:

### Option 1: Manual Update (Recommended)
```markdown
---
# ... other fields
playwright: Automated
---
```

Update the `playwright` field to indicate automation status.

### Option 2: Automated Update (Future)
```typescript
// Read manual test
const content = readFile('data/test-cases/calls/MM-T5382.md');

// Update frontmatter
const updated = content.replace(
  /playwright: null/,
  'playwright: Automated'
);

// Write back
writeFile('data/test-cases/calls/MM-T5382.md', updated);

// Commit and push
// git add data/test-cases/calls/MM-T5382.md
// git commit -m "Mark MM-T5382 as automated"
```

## CI/CD Integration

### Gap Analysis in CI
```yaml
# .github/workflows/e2e-coverage.yml
name: E2E Coverage Check

on: [pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Clone test management repo
        run: |
          git clone https://github.com/mattermost/mattermost-test-management ../mattermost-test-management

      - name: Analyze coverage
        run: |
          claude @gap-analyzer "Generate JSON coverage report" > coverage.json

      - name: Check coverage threshold
        run: |
          coverage=$(jq '.summary.coverage_percentage' coverage.json)
          echo "Current coverage: $coverage%"

          if (( $(echo "$coverage < 35" | bc -l) )); then
            echo "❌ Coverage below threshold (35%)"
            exit 1
          fi

      - name: Post report to PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('coverage.json', 'utf8');
            const data = JSON.parse(report);

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## E2E Test Coverage\n\n` +
                    `Coverage: ${data.summary.coverage_percentage}%\n` +
                    `Automated: ${data.summary.automated_tests}/${data.summary.total_manual_tests}`
            });
```

### Automatic Conversion on PR
```yaml
# .github/workflows/auto-convert.yml
name: Auto-Convert Manual Tests

on:
  workflow_dispatch:
    inputs:
      feature:
        description: 'Feature area to convert (e.g., calls, messaging)'
        required: true

jobs:
  convert:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Clone test management repo
        run: |
          git clone https://github.com/mattermost/mattermost-test-management ../mattermost-test-management

      - name: Convert tests
        run: |
          claude @manual-converter "Convert all ${{ github.event.inputs.feature }} tests"

      - name: Create PR
        run: |
          git checkout -b auto-convert-${{ github.event.inputs.feature }}
          git add e2e-tests/playwright/specs/
          git commit -m "Auto-convert ${{ github.event.inputs.feature }} manual tests to E2E"
          gh pr create --title "E2E: Auto-convert ${{ github.event.inputs.feature }} tests" \
                       --body "Automated conversion of manual tests using @manual-converter"
```

## Best Practices

### 1. Keep Test Keys Consistent
- Always include MM-T key in E2E test title
- Format: `test('MM-TXXX descriptive title', ...)`
- Makes gap analysis accurate

### 2. Update Manual Tests After Automation
- Set `playwright: Automated` when E2E test merges
- Prevents duplicate automation efforts
- Keeps coverage reports accurate

### 3. Maintain Directory Structure Alignment
- Place E2E tests in directories matching manual test paths
- Makes tests easy to find and maintain
- Helps with bulk operations

### 4. Use Priority to Guide Automation
- Start with P1 tests (critical)
- Then P2 tests (important)
- P3/P4 as time permits

### 5. Track Automation Status
- Use `playwright: In Progress` while working on E2E test
- Update to `Automated` when test passes and merges
- Leave as `null` if not yet started

### 6. Regular Gap Analysis
- Run gap analysis weekly or per sprint
- Track coverage improvements over time
- Identify new gaps from manual tests added

### 7. Coordinate Between Teams
- QA writes manual tests first
- Dev converts high-priority tests to E2E
- Update both repositories to reflect automation status

## Troubleshooting

### Issue: Can't find manual test repo
**Solution:** Verify path `/Users/yasserkhan/Documents/mattermost/mattermost-test-management/` exists

### Issue: key-and-path.json missing
**Solution:** Regenerate using `npm run index` in test management repo

### Issue: Test key mismatch
**Solution:** Ensure manual test key matches E2E test title exactly (case-sensitive)

### Issue: Coverage seems wrong
**Solution:**
- Check `playwright` field in manual tests
- Verify E2E test titles have correct MM-T format
- Look for duplicate keys

### Issue: Directory mapping unclear
**Solution:** Use key-and-path.json as source of truth, or place in generic location

## Summary

The integration between manual test management and E2E automation:
- **Maintains traceability** via MM-T keys
- **Organizes tests** with aligned directory structures
- **Tracks status** using automation fields
- **Prioritizes work** based on test priority
- **Enables automation** through gap analysis and conversion

This two-repository system preserves the QA workflow while enabling systematic E2E test automation.
