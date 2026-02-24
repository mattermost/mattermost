# E2E Test Generation and Healing Guide

## Overview

This guide explains how to generate tests for identified P0/P1 flows and heal flaky/failing tests.

---

## Part 1: Test Generation

### Automatic Generation (Full Pipeline)

```bash
# Generate tests for all impacted P0/P1 flows
npm run gen:tests
```

This runs the complete pipeline:
1. Syncs test→flow mappings
2. Analyzes impact of changes
3. Generates tests (if available)
4. Auto-heals failing tests
5. Updates mappings

### Manual Generation for Specific Flows

If you want to generate tests for specific flows manually:

```bash
# Generate test for a single flow
npx tsx e2e-test-gen-cli.ts generate "Flow Name" \
  --output ./specs/functional/ai-assisted/flow-slug \
  --scenarios 3 \
  --base-url http://localhost:8065 \
  --headless \
  --browser chrome \
  --project chrome
```

#### Parameters

- `"Flow Name"` - Name of the flow (e.g., "Send Button", "Advanced Text Editor")
- `--output <dir>` - Output directory for generated test
- `--scenarios <n>` - Number of test scenarios (default: 3)
- `--base-url <url>` - Base URL for tests (default: http://localhost:8065)
- `--headless` - Run in headless mode
- `--browser <name>` - Browser to use (chrome, firefox, webkit)
- `--project <name>` - Playwright project name

#### Example: Generate tests for identified P0 flows

```bash
# Send Button flow
npx tsx e2e-test-gen-cli.ts generate "Send Button" \
  --output ./specs/functional/ai-assisted/send_button \
  --scenarios 3

# Advanced Text Editor flow
npx tsx e2e-test-gen-cli.ts generate "Advanced Text Editor" \
  --output ./specs/functional/ai-assisted/advanced_text_editor \
  --scenarios 3
```

### Identifying Which Flows Need Tests

Check the gap report:

```bash
npm run gap
```

This outputs:
- `.e2e-ai-agents/gap-report.md` - Human-readable gaps
- `.e2e-ai-agents/gap.json` - Machine-readable data

Look for **P0 flows** (highest priority) that need test coverage.

---

## Part 2: Test Healing (Fixing Flaky Tests)

### What is "Healing"?

Healing fixes failing or flaky tests by:
- Running tests and analyzing failures
- Identifying common issues (API errors, timeout issues, selector failures)
- Suggesting and applying fixes

### Option 1: Heal Specific Test Files

You can heal individual test files without needing a full Playwright JSON report:

```bash
npx tsx e2e-test-gen-cli.ts heal specs/functional/ai-assisted/send_button/send_button.spec.ts
```

This runs the test and validates it passes.

#### Multiple Test Files

```bash
# Heal all tests in a directory
for file in specs/functional/ai-assisted/*//*.spec.ts; do
  npx tsx e2e-test-gen-cli.ts heal "$file"
done
```

### Option 2: Heal with Full Playwright Report

First, run tests and generate a Playwright report:

```bash
# Run tests and generate JSON report
npx playwright test --reporter=json > test-results.json

# Heal failing tests using the report
node ./node_modules/@yasserkhanorg/e2e-agents/dist/cli.js heal \
  --path ../../webapp \
  --traceability-report ./test-results.json
```

### Option 3: Auto-Heal PR (CI-friendly)

Automatically heal tests in a pull request:

```bash
npm run test:ai:heal
```

This attempts to heal all generated tests and creates commits with fixes.

---

## Part 3: Complete Workflow Example

### Scenario: You changed the send button component

```bash
# Step 1: Check what's impacted
npm run test:ai:impact

# Step 2: See what tests are needed
npm run gap

# Step 3: Generate tests for P0 flows
npx tsx e2e-test-gen-cli.ts generate "Send Button" \
  --output ./specs/functional/ai-assisted/send_button

npx tsx e2e-test-gen-cli.ts generate "Advanced Text Editor" \
  --output ./specs/functional/ai-assisted/advanced_text_editor

# Step 4: Run and validate the tests
npm run test -- ai-assisted

# Step 5: Heal any failing tests
npx tsx e2e-test-gen-cli.ts heal specs/functional/ai-assisted/send_button/send_button.spec.ts
npx tsx e2e-test-gen-cli.ts heal specs/functional/ai-assisted/advanced_text_editor/advanced_text_editor.spec.ts

# Step 6: Update test mappings
npm run test:manifest:sync

# Step 7: Commit changes
git add .
git commit -m "feat: add send button tests"
```

---

## Part 4: Healing Flaky Tests in Your Codebase

### For Existing Test Files (Not Generated)

If you have existing tests that are flaky:

```bash
# Option 1: Quick heal (using e2e-test-gen-cli)
npx tsx e2e-test-gen-cli.ts heal specs/functional/channels/messages.spec.ts

# Option 2: With Playwright validation
npx playwright test specs/functional/channels/messages.spec.ts --grep "@flaky"
```

### Identifying Flaky Tests

```bash
# Run tests with retry tracking
npx playwright test --retries 2 > flaky-report.txt

# Heal tests that failed initially
grep "flaky\|failed" flaky-report.txt | awk '{print $1}' | while read file; do
  npx tsx e2e-test-gen-cli.ts heal "$file"
done
```

### Bulk Healing Multiple Files

```bash
# Create a heal script
cat > heal-tests.sh << 'EOF'
#!/bin/bash
for file in "$@"; do
  echo "Healing: $file"
  npx tsx e2e-test-gen-cli.ts heal "$file" 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ $file - fixed"
  else
    echo "❌ $file - needs manual review"
  fi
done
EOF

chmod +x heal-tests.sh

# Use it
./heal-tests.sh specs/functional/ai-assisted/*/*.spec.ts
```

---

## Part 5: Customizing Generated Tests

Generated tests are templates. Customize them:

```typescript
// specs/functional/ai-assisted/send_button/send_button.spec.ts

test('should send message via send button', async ({ page }) => {
  // Navigate to channel
  await page.goto('http://localhost:8065/team/ch1');

  // Find message composer
  const composer = page.locator('[data-testid="msg_input"]');

  // Type a message
  await composer.fill('Hello world');

  // Click send button
  const sendButton = page.locator('[data-testid="SendMessageButton"]');
  await sendButton.click();

  // Verify message appears
  const messages = page.locator('[class*="RootPost"]');
  await expect(messages).toContainText('Hello world');
});
```

---

## Part 6: Configuration

### e2e-ai-agents.config.json

```json
{
  "pipeline": {
    "enabled": true,
    "scenarios": 3,
    "outputDir": "specs/functional/ai-assisted",
    "heal": true,
    "mcp": true,
    "mcpAllowFallback": false,
    "baseUrl": "http://localhost:8065",
    "browser": "chrome",
    "headless": true,
    "project": "chrome",
    "parallel": true,
    "parallelLimit": 4,
    "timeout": 300000
  }
}
```

### Key Settings

- `scenarios` - Number of test cases per flow (3-5 recommended)
- `outputDir` - Where to write generated tests
- `heal` - Auto-fix failing tests
- `mcp` - Use Claude MCP for smarter generation
- `timeout` - Test timeout in milliseconds
- `parallel` - Run tests in parallel during generation/healing

---

## Part 7: Troubleshooting

### Tests not generating

```bash
# Check if e2e-test-gen-cli.ts exists
ls -la e2e-test-gen-cli.ts

# Check flows.json exists
ls -la .e2e-ai-agents/flows.json

# Verify CLI command works
npx tsx e2e-test-gen-cli.ts generate "Test Flow" --output ./test-output
```

### Heal validation failing

```bash
# Run test manually to see error
npx playwright test specs/functional/ai-assisted/send_button/send_button.spec.ts --reporter=verbose

# Check test syntax
npx tsc --noEmit specs/functional/ai-assisted/send_button/send_button.spec.ts
```

### Flaky tests not healing

```bash
# Increase timeout
npx playwright test specs/...spec.ts --timeout=60000

# Run with retries to identify exact issue
npx playwright test specs/...spec.ts --retries 3 --verbose
```

---

## Commands Reference

```bash
# Generation
npm run gen:tests                      # Full pipeline
npx tsx e2e-test-gen-cli.ts generate   # Manual generation
npx tsx e2e-test-gen-cli.ts heal       # Heal specific test

# Analysis
npm run test:ai:impact                 # Impact analysis
npm run gap                            # Gap analysis
npm run test:manifest:sync             # Update test mappings

# Validation
npm run test -- ai-assisted            # Run generated tests
npm run test:ai:health                 # Check LLM provider
```

---

## Next Steps

1. **Run gap analysis** to see which flows need tests
2. **Generate tests** for P0/P1 flows
3. **Run and validate** the tests locally
4. **Heal failing tests** to fix issues
5. **Customize** tests to match your actual flows
6. **Commit** to your branch

