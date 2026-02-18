# AI-Assisted Test Generation Guide

Comprehensive guide to using e2e-agents for intelligent test coverage and generation.

---

## Table of Contents

1. [Overview & When to Use](#overview--when-to-use)
2. [Command Reference](#command-reference)
3. [Typical Workflows](#typical-workflows)
4. [Configuration](#configuration)
5. [Troubleshooting](#troubleshooting)
6. [Examples](#examples)
7. [FAQ](#faq)

---

## Overview & When to Use

### What is e2e-agents?

e2e-agents is an LLM-powered tool that:

- **Detects test gaps** — Identifies which user flows lack test coverage
- **Analyzes impact** — Shows which flows are affected by code changes
- **Generates tests** — Creates valid Playwright test files automatically
- **Heals failures** — Auto-fixes failing tests across 3 healing iterations
- **Tracks traceability** — Maps tests to the code flows they cover

### Test Coverage Prioritization

Tests are prioritized by risk:

- **P0 (Critical)** — Core user journeys (messaging, channels, authentication)
- **P1 (High)** — Important features (user profiles, settings, integrations)
- **P2 (Medium)** — Nice-to-have features and edge cases

### When to Run

| Scenario | Command | Purpose |
|----------|---------|---------|
| Before PR merge | `npm run test:ai:gap` | Check if critical flows are tested |
| After code changes | `npm run test:ai:impact` | Identify affected flows |
| Adding new feature | `npm run test:ai:generate` | Create tests for new code |
| Fixing test failures | `npm run test:ai:heal` | Auto-fix broken tests |
| Quarterly maintenance | `npm run test:ai:gap` | Assess overall coverage |

---

## Command Reference

### test:ai:gap

Identifies test coverage gaps across all flows.

```bash
npm run test:ai:gap
```

**Output**:
- `.e2e-ai-agents/reports/gap-report.md` — Human-readable gaps
- `.e2e-ai-agents/gap.json` — Structured data for processing

**Use when**:
- Assessing overall test coverage
- Planning test improvements
- Quarterly coverage reviews

**Example output**:
```
Gap Analysis Report
Flows: P0=8 P1=7 P2=0
Impacted Flows:
- [P0] Send Message - 15 tests (COVERED)
- [P0] Realtime Receive - 8 tests (COVERED)
- [P1] User Profile - 0 tests (GAP!)
```

---

### test:ai:impact

Shows which flows are affected by code changes. **Feature branch only.**

```bash
npm run test:ai:impact
```

**Requirements**:
- Must be on a feature branch with changes
- Compares against `origin/master`
- Analyzes only changed files

**Output**:
- `.e2e-ai-agents/reports/impact-plan.md` — Impact analysis
- `.e2e-ai-agents/impact.json` — Structured results

**Use when**:
- Before submitting PR
- Ensuring critical changes are covered
- Planning which tests to generate

**Example output**:
```
Impact Analysis
Changed files: 5
Affected flows:
- [P0] Authentication (confidence: 95%)
- [P1] Session Management (confidence: 87%)
- [P1] Logout Flow (confidence: 92%)

Test recommendation: Generate tests for these 3 P0/P1 flows
```

---

### test:ai:plan

Plans test generation strategy.

```bash
npm run test:ai:plan
```

**Output**:
- Recommended tests to generate
- Which flows need coverage
- Generation strategy

**Use when**:
- Before running `test:ai:generate`
- Understanding what tests will be created

---

### test:ai:generate

Generates test files using Claude AI.

```bash
npm run test:ai:generate [--scenarios N] [--headless]
```

**Options**:
- `--scenarios N` — Generate N test scenarios per flow (default: 3)
- `--headless` — Run in headless mode
- `--mcp` — Use Playwright MCP server for exploration

**Output**:
- `specs/functional/ai-assisted/<flow>/<flow>.spec.ts` — Generated test files

**Use when**:
- After `gap` or `impact` identifies flows to test
- Generating initial test suite for new feature
- Adding test coverage for risky code changes

**Example**:
```bash
# Generate 5 test scenarios per flow
npm run test:ai:generate --scenarios 5

# Generation takes 2-5 minutes
# Files created: specs/functional/ai-assisted/messaging.send/send_message.spec.ts
```

---

### test:ai:heal

Auto-fixes failing tests.

```bash
npm run test:ai:heal
```

**Process**:
1. Runs tests
2. Collects failures
3. Re-explores UI
4. Generates fixes
5. Repeats up to 3 times

**Use when**:
- Generated tests fail
- UI selectors become stale
- After refactoring code

**Example**:
```bash
npm run test:ai:heal

# Output:
# Healing iteration 1/3: Fixed 3/5 failures
# Healing iteration 2/3: Fixed 2/2 failures
# Final result: All tests passing ✅
```

---

### test:ai:finalize

Commits generated tests to git.

```bash
npm run test:ai:finalize [--message "msg"] [--create-pr]
```

**Options**:
- `--message` — Custom commit message
- `--create-pr` — Create PR instead of committing to branch

**Use when**:
- Tests are passing and ready
- Committing generated tests to feature branch
- Creating PR with generated tests

---

### test:ai:health

Check LLM provider status.

```bash
npm run test:ai:health
```

**Output**:
```
Anthropic OK (claude-sonnet-4-5-20250929) -> OK.
```

**Use when**:
- Troubleshooting generation failures
- Verifying API credentials
- Checking rate limits

---

## Typical Workflows

### Workflow 1: Close Test Coverage Gaps

When you want to improve overall test coverage:

```bash
# 1. See what's missing
npm run test:ai:gap

# 2. Review gap-report.md and pick a P0/P1 flow to test
cat .e2e-ai-agents/reports/gap-report.md | grep "P1"

# 3. Generate tests for that flow
npm run test:ai:generate

# 4. Run tests
npm run test -- ai-assisted

# 5. If tests fail, auto-fix them
npm run test:ai:heal

# 6. Commit generated tests
npm run test:ai:finalize --message "tests: add coverage for <flow>"
```

**Timeline**: ~15 minutes per flow

**Expected result**: 3-5 new test files, 70-90% pass rate on first try

---

### Workflow 2: Validate Feature Branch Coverage

When you've made code changes and want to ensure they're tested:

```bash
# 1. Analyze which flows are affected
npm run test:ai:impact

# 2. Review impact report
cat .e2e-ai-agents/reports/impact-plan.md

# 3. Generate tests for affected P0/P1 flows
npm run test:ai:generate --scenarios 3

# 4. Run and heal
npm run test -- ai-assisted
npm run test:ai:heal

# 5. Create PR with generated tests
npm run test:ai:finalize --create-pr
```

**Timeline**: ~20 minutes

**Expected result**: Tests for all affected critical flows

---

### Workflow 3: Add Tests for New Feature

When you've added a new user-facing feature:

```bash
# 1. Update flow catalog (if needed)
# Edit: .e2e-ai-agents/flows.json
# Add entry for new flow with keywords, paths, audience

# 2. Generate tests
npm run test:ai:generate --scenarios 5

# 3. Run
npm run test -- ai-assisted

# 4. Heal any failures
npm run test:ai:heal

# 5. Commit
npm run test:ai:finalize --create-pr
```

**Timeline**: ~25 minutes

**Expected result**: Complete test suite for new feature

---

## Configuration

**File**: `.e2e-ai-agents/flows.json`

Defines which user flows exist and where they're tested.

### Flow Entry Structure

```json
{
  "flows": [
    {
      "id": "messaging.send",
      "name": "Send Message",
      "priority": "P0",
      "keywords": ["message", "post", "send"],
      "paths": ["channels/src/components/post/**"],
      "tests": ["specs/functional/ai-assisted/messaging.send/send_message.spec.ts"],
      "audience": ["member", "guest"],
      "flags": [{"name": "WysiwygEditor", "source": "feature"}]
    }
  ]
}
```

### Field Descriptions

| Field | Purpose | Example |
|-------|---------|---------|
| `id` | Unique flow identifier | `messaging.send` |
| `name` | Human-readable flow name | `Send Message` |
| `priority` | P0 (critical) or P1 (high) | `P0` |
| `keywords` | Words that identify this flow | `["message", "post"]` |
| `paths` | Code paths involved in flow | `["channels/src/components/post/**"]` |
| `tests` | Test files that cover this flow | `["specs/functional/ai-assisted/.../...spec.ts"]` |
| `audience` | Who uses this flow | `["member", "guest"]` |
| `flags` | Feature flags that gate this flow | `[{"name": "WysiwygEditor"}]` |

### When to Update flows.json

- **Adding new feature** — Add flow entry
- **Removing feature** — Remove flow entry
- **Changing paths** — Update path globs
- **Feature flag changes** — Update flags section

**Note**: Keep flow catalog in sync with actual code. Stale catalog = inaccurate gap analysis.

---

## Troubleshooting

### "No changed files detected"

**Cause**: Running on main branch with no changes, or not in feature branch

**Solution**:
```bash
# Use gap analysis instead (works without changes)
npm run test:ai:gap

# OR explicitly allow fallback
npx e2e-ai-agents impact --allow-fallback
```

---

### Generated tests fail

**Normal behavior**: First-generation tests often fail due to UI differences

**Solution**:
```bash
npm run test:ai:heal
```

This re-explores the UI and auto-fixes failing tests. Success rate: 70-80%.

---

### Generated tests have wrong selectors

**Cause**: UI elements not discoverable or labeled

**Solution**:
1. Add accessibility labels to component (aria-label, data-testid)
2. Re-run generation
3. Or manually adjust selectors in generated test

**Example fix**:
```typescript
// Before (can't find button)
await page.getByRole('button', {name: 'Save'}).click();

// After (with data-testid)
await page.locator('[data-testid="save-button"]').click();
```

---

### "LLM health check failed"

**Cause**: No API credentials or rate limited

**Solution**:
```bash
# Check credentials
echo $ANTHROPIC_API_KEY

# Verify it's set and not empty
# If empty, set it:
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Check LLM health
npm run test:ai:health
```

**Rate limits**: Anthropic limits to 50,000 tokens/minute. Most generations use <5,000 tokens.

---

### "Command not found: npm run test:ai:gap"

**Cause**: npm scripts not yet updated or npm cache stale

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm install

# Try command again
npm run test:ai:gap
```

---

### Tests generated but files are in wrong location

**Cause**: Config paths not set correctly

**Solution**:
Check `e2e-ai-agents.config.json`:
```json
{
  "path": "../../webapp",           // Correct path to webapp
  "testsRoot": ".",                  // Tests root (should be . in this dir)
  "pipeline": {
    "outputDir": "specs/functional/ai-assisted"  // Where tests are created
  }
}
```

---

## Examples

### Example 1: Generate Tests for "Create Channel" Flow

```bash
# 1. See current gap
npm run test:ai:gap | grep -i channel

# Output shows: [P0] Channel Creation - 0 tests (GAP!)

# 2. Generate tests
npm run test:ai:generate

# 3. Run them
npm run test -- "ai-assisted" --grep "channel"

# 4. Heal if needed
npm run test:ai:heal

# 5. Commit
npm run test:ai:finalize --message "tests: add channel creation tests"
```

**Result**: 3-5 test files with 15-20 test cases

---

### Example 2: Impact Analysis for Auth Changes

```bash
# On feature branch with auth changes
npm run test:ai:impact

# Review impact report
cat .e2e-ai-agents/reports/impact-plan.md

# Output shows:
# Affected flows:
# - [P0] Authentication (confidence: 95%)
# - [P1] Session Management (confidence: 87%)
# Recommendation: Generate tests for these flows

# Generate tests
npm run test:ai:generate --scenarios 5

# Run and validate
npm run test -- ai-assisted
npm run test:ai:heal

# Create PR with generated tests
npm run test:ai:finalize --create-pr
```

**Result**: Tests for all critical auth flows before PR merge

---

### Example 3: Quarterly Coverage Review

```bash
# Once per quarter, assess coverage
npm run test:ai:gap

# Review report
cat .e2e-ai-agents/reports/gap-report.md

# Expected:
# - P0 flows: 100% tested
# - P1 flows: 80%+ tested
# - Coverage gaps identified

# For each gap, run Workflow 1 to close it
```

**Result**: Clear view of coverage quality and improvement priorities

---

## FAQ

**Q: Will e2e-agents replace manual testing?**

A: No. It generates tests for critical paths and helps find gaps. Manual exploratory testing is still essential for discovering UX issues and edge cases.

---

**Q: Can I edit generated tests?**

A: Yes. After generation, tests are just regular Playwright spec files. Edit freely. Just be aware that if you run healing again, it may regenerate them.

---

**Q: How long does test generation take?**

A: ~2-5 minutes depending on flow complexity and number of scenarios. Uses Claude AI, so timing varies with API load.

---

**Q: What about generated test flakiness?**

A: Initial tests may be flaky due to timing or selector issues. The healing process fixes 70-80% of failures. If issues remain, consider:
1. Adding accessibility labels to components
2. Using more specific selectors
3. Increasing wait times in generated tests

---

**Q: Can I use this in CI/CD?**

A: Yes. Currently set up for manual usage. CI/CD integration is being added (see main README).

---

**Q: How do I customize test generation?**

A: Edit the config file `.e2e-ai-agents.config.json`:
```json
{
  "pipeline": {
    "scenarios": 3,              // Change from 3 to 5 scenarios
    "outputDir": "specs/...",    // Change output directory
    "heal": true,                // Disable auto-healing
    "mcp": true                  // Use MCP exploration
  }
}
```

---

**Q: What LLMs are supported?**

A: Currently:
- Anthropic Claude (default) — Best quality, higher cost
- OpenAI GPT-4 — Good quality, similar cost
- Ollama (local) — Free, lower quality

Configure in `e2e-ai-agents.config.json`.

---

**Q: How much does this cost?**

A: For Claude (typical flow):
- Gap analysis: <$0.01
- Test generation (3 scenarios): ~$0.50
- Healing (3 iterations): ~$0.30
- **Total per flow**: ~$0.80

For 10 new features: ~$8/month

---

**Q: Where are generated tests stored?**

A: `specs/functional/ai-assisted/<flow-id>/` directory structure:
```
specs/functional/ai-assisted/
├── messaging.send/
│   └── send_message.spec.ts      (generated tests)
├── user.profile/
│   └── user_profile.spec.ts
└── channels.create/
    └── create_channel.spec.ts
```

---

**Q: How do I delete generated tests?**

A: Simply delete the spec file:
```bash
rm specs/functional/ai-assisted/messaging.send/send_message.spec.ts
```

Tests are independent files. Deleting won't affect anything else.

---

## Getting Help

| Issue | Resource |
|-------|----------|
| Technical errors | Check logs in `.e2e-ai-agents/logs/` |
| LLM issues | Run `npm run test:ai:health` |
| Flow catalog questions | Ask QA lead about flows.json |
| General troubleshooting | See Section 5 (Troubleshooting) above |
| Feature requests | Contact project lead |

---

**Last updated**: February 17, 2026
**e2e-agents version**: 0.3.4+
