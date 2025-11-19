# E2E Test Creation Skill for Mattermost

**Automatically generate E2E Playwright tests with Zephyr integration**

## Overview

This Claude skill provides automated E2E test generation for Mattermost using Playwright. It combines:
- **Live browser exploration** via Playwright MCP
- **Focused test generation** (1-3 tests by default)
- **Zephyr test management integration** (bidirectional sync)
- **Self-healing capabilities** for broken tests

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup](#setup)
3. [Workflows](#workflows)
4. [File Organization](#file-organization)
5. [Documentation](#documentation)

---

## Quick Start

### 1. Enable MCP (One-Time Setup)

Edit your Claude Code configuration:

**Location:**
- Mac/Linux: `~/.config/claude-code/config.json`
- Windows: `%APPDATA%\claude-code\config.json`

**Add:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp-server@latest"]
    }
  }
}
```

**Restart Claude Code** after saving.

### 2. Install Playwright Browsers

```bash
cd e2e-tests/playwright
npx playwright install
```

### 3. Create Your First Test

```
You: "Create E2E tests for the channel sidebar feature"
```

Claude will:
1. 🔍 Launch browser and explore the UI
2. 📝 Create focused test plan (1-3 scenarios)
3. ⚡ Generate executable Playwright tests
4. ✅ Run tests with Chrome
5. 🔧 Auto-heal any failures

---

## Setup

### Prerequisites

- Node.js 18+ installed
- Mattermost instance running (usually `http://localhost:8065`)
- Playwright browsers installed
- Claude Code with MCP enabled

### Zephyr Integration (Optional)

If you want to sync with Zephyr test management, create `.claude/settings.local.json` at repo root:

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

**Get credentials:**
- **JIRA Token**: https://id.atlassian.com/manage-profile/security/api-tokens
- **Zephyr Token**: Zephyr Scale settings in JIRA → API Access Tokens

---

## Workflows

### Workflow 1: Create New Tests (Default)

**Use when:** Adding tests for a new feature

```
You: "Create tests for post reactions"
```

**What happens:**
1. Claude launches browser via MCP
2. Explores the feature UI
3. Discovers actual selectors from DOM
4. Generates 1-3 focused tests
5. Places tests in `specs/functional/ai-assisted/messaging/`
6. Runs with `--project=chrome`

**Output:**
```
✅ Generated: specs/functional/ai-assisted/messaging/post_reactions.spec.ts
✅ Tests: 2 passing
```

---

### Workflow 2: Create Tests + Zephyr Sync

**Use when:** You need Zephyr test cases created

```
You: "Create tests for login feature with Zephyr sync"
```

**What happens:**
1. Planning → Skeleton generation
2. **Creates Zephyr test cases** (MM-T1234, MM-T1235)
3. Generates full Playwright code with MM-T keys
4. Runs tests
5. **Updates Zephyr** with automation status

**Output:**
```
✅ Generated: specs/functional/ai-assisted/auth/login.spec.ts
✅ Zephyr Cases: MM-T1234, MM-T1235
✅ Tests: 2 passing
✅ Zephyr Updated: Marked as automated
```

---

### Workflow 3: Automate Existing Zephyr Test Case

**Use when:** You have a manual Zephyr test case (MM-TXXXX) that needs automation

```
You: "Automate MM-T5928"
```

**What happens:**
1. Fetches test case from Zephyr
2. Analyzes steps and objectives
3. Generates Playwright test
4. Updates Zephyr with automation file path

---

### Workflow 4: Create Zephyr Case from Existing E2E Test (Reverse)

**Use when:** You have an E2E test but no Zephyr coverage

```
You: "Create Zephyr test case for specs/functional/ai-assisted/channels/threads_list.spec.ts"
```

**What happens:**
1. Analyzes E2E test code
2. Extracts steps, objective, category
3. **Creates new Zephyr test case**
4. Updates E2E file with MM-T key
5. Marks as automated in Zephyr

---

### Workflow 5: Fix Broken Tests (Healing)

**Use when:** Tests are failing or flaky

```
You: "Fix the failing test in specs/functional/ai-assisted/channels/create_channel.spec.ts"
```

**What happens:**
1. Analyzes failure logs
2. Launches browser to inspect current UI
3. Discovers updated selectors
4. Applies targeted fixes
5. Re-runs tests to verify

---

## File Organization

### Test Locations

**AI-generated tests:**
```
e2e-tests/playwright/specs/functional/ai-assisted/
├── channels/          # Channel-related tests
├── messaging/         # Message, post, thread tests
├── system_console/    # Admin console tests
└── ...
```

**Why `ai-assisted/`?**
- ✅ Easy to track AI-generated vs manual tests
- ✅ Run separately: `npx playwright test specs/functional/ai-assisted/`
- ✅ Clear attribution for quality metrics

### Running Tests

```bash
# Run all AI-generated tests
npx playwright test specs/functional/ai-assisted/ --project=chrome

# Run specific category
npx playwright test specs/functional/ai-assisted/channels/ --project=chrome

# Run specific test
npx playwright test content_flagging.spec.ts --project=chrome
```

**Note:** Always use `--project=chrome` for AI-generated tests (most reliable).

---

## Documentation

### Core Guidelines
- **[skill.md](skill.md)** - Main skill definition and overview
- **[guidelines.md](guidelines.md)** - Comprehensive test creation guidelines
- **[examples.md](examples.md)** - Real-world test examples
- **[mattermost-patterns.md](mattermost-patterns.md)** - Mattermost-specific patterns

### Agents
- **[agents/planner.md](agents/planner.md)** - Test planning with MCP browser exploration
- **[agents/generator.md](agents/generator.md)** - Test code generation patterns
- **[agents/healer.md](agents/healer.md)** - Test healing strategies
- **[agents/skeleton-generator.md](agents/skeleton-generator.md)** - Skeleton file generation
- **[agents/zephyr-sync.md](agents/zephyr-sync.md)** - Zephyr synchronization orchestration
- **[agents/test-automator.md](agents/test-automator.md)** - Automate existing Zephyr cases
- **[agents/e2e-to-zephyr-sync.md](agents/e2e-to-zephyr-sync.md)** - Reverse: E2E → Zephyr

### Workflows
- **[workflows/README.md](workflows/README.md)** - Workflow overview
- **[workflows/main-workflow.md](workflows/main-workflow.md)** - 3-stage pipeline (Plan → Skeleton → Zephyr + Code)
- **[workflows/automate-existing.md](workflows/automate-existing.md)** - Automate existing test cases

### Tools
- **[tools/zephyr-api.md](tools/zephyr-api.md)** - Zephyr API integration
- **[tools/placeholder-replacer.md](tools/placeholder-replacer.md)** - Placeholder replacement utility

---

## Features

### 🎯 Focused Test Generation (Default)
- Generates **1-3 tests** by default
- Focuses on core business logic
- Saves AI costs and time
- Expands only when explicitly requested

### 🔍 Live Browser Exploration via MCP
- Launches **real browser** to explore UI
- Discovers **actual selectors** from DOM
- Takes screenshots during exploration
- No guessing - uses real-time inspection

### 🔄 Bidirectional Zephyr Sync
- **Zephyr → E2E**: Automate existing test cases
- **E2E → Zephyr**: Create test cases from E2E tests
- **Full Pipeline**: Plan → Skeleton → Zephyr → Code
- **Auto-updates**: Automation status, file paths, labels

### 🔧 Self-Healing Tests
- Detects outdated selectors
- Uses live browser to find current selectors
- Applies targeted fixes
- Prevents future flakiness

### ✅ Chrome-Only Execution
- Most reliable for AI-generated tests
- Faster feedback loop
- Easier debugging
- Can expand to multi-browser later

---

## Test Quality Standards

Generated tests follow Mattermost conventions:

✅ Use `pw` fixture and page objects
✅ Standalone tests (no `test.describe()`)
✅ Semantic selectors (`data-testid`, ARIA roles)
✅ Proper async/await patterns
✅ API-based test data setup
✅ JSDoc with `@objective`
✅ Action comments (`// #`) and verification comments (`// *`)
✅ MM-TXXXX prefixes for Zephyr-linked tests

---

## Cost Efficiency

**Default mode (Tier 1):**
- 1-3 tests generated
- Focus on happy path + critical errors
- 50%+ reduction in AI generation time
- Tests core business logic only

**Comprehensive mode (Tier 2/3):**
- Only when explicitly requested
- 5+ tests with edge cases
- Multi-user scenarios
- Full coverage

Say: *"Create comprehensive tests with edge cases"* to activate.

---

## Troubleshooting

### MCP not working

**Check:**
1. Is `@playwright/mcp-server` installed? `npm list -g @playwright/mcp-server`
2. Did you restart Claude Code after config change?
3. Is the config JSON valid? Check for trailing commas.

### Tests failing

**Try:**
1. Update selectors: *"Fix the failing test in [file path]"*
2. Check Mattermost is running: `curl http://localhost:8065`
3. Re-install browsers: `npx playwright install`

### Zephyr sync not working

**Check:**
1. Is `.claude/settings.local.json` configured?
2. Are tokens valid? Test in Postman/curl.
3. Is `folderId` correct for your project?

---

## Examples

### Example 1: Simple Feature Test
```
You: "Create tests for the channel sidebar"
```

**Output:**
```typescript
// specs/functional/ai-assisted/channels/channel_sidebar.spec.ts

/**
 * @objective Verify user can expand and collapse channel sidebar
 */
test('MM-TXXXX should toggle sidebar visibility', {tag: '@channels'}, async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Click sidebar toggle button
    await channelsPage.page.click('[data-testid="sidebar-toggle"]');

    // * Verify sidebar is collapsed
    await expect(channelsPage.page.locator('[data-testid="sidebar"]'))
        .not.toBeVisible();
});
```

### Example 2: With Zephyr Sync
```
You: "Create tests for content flagging with Zephyr sync"
```

**Output:**
```typescript
// specs/functional/ai-assisted/system_console/content_flagging.spec.ts

/**
 * @objective Verify admin can enable content flagging
 * @zephyr MM-T5928
 */
test('MM-T5928 should enable content flagging in system console',
    {tag: '@system_console'}, async ({pw}) => {
    // Test implementation...
});
```

**Zephyr Updated:**
- ✅ Status: Automated
- ✅ Label: `playwright-automated`
- ✅ Automation File: `specs/functional/ai-assisted/system_console/content_flagging.spec.ts`

---

## Interactive Mode

This skill works **interactively** with you:

1. **Shows** what it's doing at each step
2. **Asks** for your review before major actions
3. **Waits** for your confirmation to proceed
4. **Launches** real browsers you can observe
5. **Displays** screenshots of discoveries

**No silent automation. Full transparency.**

---

## Activation

### Automatic Activation

The skill activates when:
- Files in `webapp/` directory are modified
- React components are created/updated
- You explicitly request test generation

### Manual Activation

```
You: "Create E2E tests for [feature]"
You: "Automate MM-T1234"
You: "Fix failing test in [file]"
```

---

## Next Steps

1. ✅ **Setup MCP** following instructions above
2. 📖 **Read [guidelines.md](guidelines.md)** for detailed patterns
3. 🎯 **Try it:** *"Create tests for channel creation"*
4. 🔄 **Setup Zephyr** (optional) for test management sync
5. 📚 **Explore [examples.md](examples.md)** for real test samples

---

## Support

- **Issues:** Report at [GitHub Issues](https://github.com/mattermost/mattermost/issues)
- **Documentation:** All docs in `.claude/skills/e2e-test-creation/`
- **Zephyr Help:** See [workflows/README.md](workflows/README.md)

---

**Ready to create your first test?**

Try: *"Create E2E tests for the post message feature"*
