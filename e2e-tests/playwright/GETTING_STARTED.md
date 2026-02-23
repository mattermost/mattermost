# E2E Test Generation - Getting Started

Auto-generate Playwright tests for your webapp changes in **one command**.

---

## Quick Start (60 seconds)

### Prerequisites

1. **Anthropic API Key** (for Claude):
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

2. **On a feature branch** with webapp changes:
   ```bash
   git checkout -b feature/my-changes
   # Make changes to webapp/
   git add .
   git commit -m "feat: add new feature"
   ```

### Generate Tests

```bash
cd e2e-tests/playwright

# Generate tests for all affected flows
npm run gen:tests
```

**What it does:**
1. ✅ Analyzes impact of your changes
2. ✅ Generates test scenarios
3. ✅ Auto-fixes failing tests (healing)
4. ✅ Commits tests to your branch
5. ✅ Shows summary report

**Time**: 5-10 minutes depending on flow complexity

---

## What You Get

Generated tests appear in:
```
specs/functional/ai-assisted/
├── messaging.send/
│   └── messaging.send.spec.ts
├── channels.list/
│   └── channels.list.spec.ts
└── user.profile/
    └── user.profile.spec.ts
```

These are **regular Playwright tests** — you can edit, debug, and maintain them normally.

---

## Run Your Tests Locally

```bash
# Run all generated tests
npm run test -- ai-assisted

# Run specific flow tests
npm run test -- ai-assisted --grep "messaging.send"

# Run with UI (watch mode)
npm run playwright-ui -- ai-assisted
```

---

## Troubleshooting

### ❌ "API key not found"
```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Verify it's set
npm run test:ai:health
```

### ❌ "No changes detected"
You're on main branch or no webapp/ changes. This is expected.

- **Feature branch with changes**: `gen:tests` works
- **Main branch**: Use `npm run gap` to see overall coverage

### ❌ "Generated tests are failing"
Normal! The auto-healing process fixes most failures. If some remain:

1. **Check selectors**: Components may need `data-testid` or `aria-label`
2. **Run healing manually**: `npm run test:ai:heal`
3. **Edit tests**: They're just Playwright code — fix them directly

### ❌ "Command not found: npm run gen:tests"
Clear npm cache:
```bash
npm cache clean --force
npm install
npm run gen:tests
```

---

## Common Workflows

### Workflow 1: Generate Tests for Feature Branch

```bash
# 1. Create feature branch
git checkout -b feature/new-channel-notifications

# 2. Make changes
# Edit webapp/channels/src/...
git commit -m "feat: add notification badges"

# 3. Generate tests
npm run gen:tests

# 4. Review generated tests
npm run test -- ai-assisted

# 5. Push and create PR
git push origin feature/new-channel-notifications
```

### Workflow 2: Check Overall Test Coverage

```bash
# See which flows lack test coverage
npm run gap

# Review the report
cat .e2e-ai-agents/reports/gap-report.md

# Pick a gap to fill
# Add to flows.json, then run:
npm run gen:tests
```

### Workflow 3: Debug Generated Tests

```bash
# Run tests in UI mode
npm run playwright-ui -- ai-assisted

# Or run with headed browser
npx playwright test specs/functional/ai-assisted/ --headed

# Or debug specific test
npx playwright test specs/functional/ai-assisted/messaging.send/ --debug
```

---

## Configuration

Edit `.e2e-ai-agents.config.json` to customize:

```json
{
  "pipeline": {
    "scenarios": 3,              // Number of test scenarios per flow
    "outputDir": "specs/functional/ai-assisted",  // Where tests go
    "heal": true,               // Auto-fix failures
    "parallelLimit": 4          // Parallel generation threads
  }
}
```

---

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run gen:tests` | **Main**: Analyze → Generate → Heal → Sync |
| `npm run gap` | See which flows lack test coverage |
| `npm run test:ai:impact` | Show flows affected by your changes |
| `npm run test:ai:generate` | Generate tests (no healing) |
| `npm run test:ai:heal` | Auto-fix failing tests |
| `npm run test:ai:health` | Check LLM provider status |
| `npm run test:manifest:sync` | Update test→flow mappings |

---

## FAQ

**Q: Will this replace manual E2E testing?**

A: No. AI-generated tests cover critical user flows. Manual exploratory testing is still essential for UX, edge cases, and unexpected interactions.

**Q: Can I edit generated tests?**

A: Yes! They're standard Playwright spec files. Edit freely. Just know that re-running `gen:tests` may regenerate them.

**Q: How much does this cost?**

A: ~$0.50-1.00 per feature (3 flows × 3 scenarios). Anthropic Claude is ~$3/1M tokens.

**Q: How long does generation take?**

A: 3-5 minutes for a typical feature (impact analysis + generation + healing).

**Q: What if tests fail on my machine?**

A:
1. Check selectors are valid (add `data-testid` if needed)
2. Run `npm run test:ai:heal` to auto-fix
3. Or manually edit the test file

**Q: Can this run in CI/CD?**

A: Yes, but we're keeping it local for now. CI/CD automation can be added later.

---

## Next Steps

1. ✅ Set up API key
2. ✅ Create feature branch
3. ✅ Run `npm run gen:tests`
4. ✅ Review generated tests
5. ✅ Push to create PR

Questions? See `AI_TESTING_GUIDE.md` for detailed documentation.

---

**Last updated**: February 23, 2026
**System**: e2e-agents v0.3.4
