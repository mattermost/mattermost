# Testing the Autonomous E2E System

## Prerequisites

1. **Mattermost server running** at `http://localhost:8065` (or configure different URL in `.env`)
2. **LLM Provider** - Choose one:
    - **Ollama (FREE, Local)** - Recommended for testing
    - **Anthropic Claude (Premium)** - Best quality, requires API key

## Option 1: Quick Test (Easiest)

Run the test script:

```bash
cd /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright
./test-autonomous.sh
```

The script will:

- Check your environment
- Ask for your PDF specification path (optional)
- Run 1 test cycle
- Show you the results

## Option 2: Manual Command

### With Ollama (Free):

```bash
# 1. Start Ollama (in separate terminal)
ollama serve

# 2. Pull model if not already installed
ollama pull deepseek-r1:7b

# 3. Run autonomous testing with PDF spec
cd /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright

npx tsx lib/src/autonomous/cli.ts \
  --base-url http://localhost:8065 \
  --username sysadmin \
  --password "Sys@dmin-sample1" \
  --llm-provider ollama \
  --llm-model deepseek-r1:7b \
  --spec /path/to/your/specification.pdf \
  --max-cycles 1
```

### With Anthropic Claude:

```bash
# 1. Set API key in .env file
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env

# 2. Run autonomous testing
cd /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright

npx tsx lib/src/autonomous/cli.ts \
  --base-url http://localhost:8065 \
  --username sysadmin \
  --password "Sys@dmin-sample1" \
  --llm-provider anthropic \
  --spec /path/to/your/specification.pdf \
  --max-cycles 1
```

## Option 3: Without PDF Specification

If you don't have a PDF spec yet, you can test general autonomous exploration:

```bash
cd /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright

npx tsx lib/src/autonomous/cli.ts \
  --base-url http://localhost:8065 \
  --username sysadmin \
  --password "Sys@dmin-sample1" \
  --llm-provider ollama \
  --llm-model deepseek-r1:7b \
  --max-cycles 1
```

## What Happens During a Test Cycle

### Phase 1: Crawl (UI Discovery)

- Navigates to your Mattermost server
- Discovers interactive elements (buttons, links, inputs)
- Captures screenshots and accessibility trees
- Stores discovered states in knowledge base

### Phase 2: Analyze (AI Understanding)

- LLM analyzes each discovered UI state
- If PDF spec provided:
    - Compares actual UI against spec screenshots
    - Identifies which features are implemented
    - Calculates match confidence

### Phase 3: Generate (Test Creation)

- Creates executable Playwright tests
- Tests saved to `specs/autonomous/`
- Each test includes:
    - Clear test objectives
    - Proper assertions
    - Accessibility-first selectors

### Phase 4: Execute (Run Tests)

- Runs generated tests
- Captures results and screenshots
- Identifies failures

### Phase 5: Heal (Self-Repair)

- Analyzes test failures
- Distinguishes bugs from UI changes
- Attempts to auto-fix selector issues

### Phase 6: Report

- Saves cycle report to knowledge base
- Shows summary statistics
- Lists discovered issues

## Expected Output

You should see output like:

```
🤖 Autonomous Testing System initialized
   Base URL: http://localhost:8065
   LLM Provider: ollama
   Mode: Single-cycle
   Parallel Contexts: 1

🚀 Starting autonomous testing...

============================================================
🔄 Cycle 1 starting...
============================================================

📍 Phase 1: Crawl
   Navigating to http://localhost:8065...
   ✓ Discovered 15 states
   ✓ New: 12, Changed: 3

📍 Phase 2: Analyze
   Analyzing states 1-10 (batch 1)...
   ✓ Analyzed 15 states

📍 Phase 3: Generate
   ✓ Generated 8 tests
   ✓ Total tests: 8

📍 Phase 4: Execute
   Running 8 tests...
   ✓ Passed: 6
   ✗ Failed: 2

📍 Phase 5: Heal
   Analyzing 2 failures...
   ✓ Healed: 1
   ✗ Needs investigation: 1

📍 Phase 6: Report
   Cycle report saved

✅ Cycle 1 completed in 45.2s

Cycle Summary:
   Discovery: 15 states (12 new, 3 changed)
   Generation: 8 tests
   Execution: 6 passed, 2 failed
   Healing: 1 auto-fixed
   Bugs: 1 detected

✨ Autonomous testing completed
```

## Viewing Results

### Knowledge Base Location

```
/Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/autonomous/knowledge.db
```

### Generated Tests Location

```
/Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/autonomous/
```

### Screenshots Location

```
/Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/autonomous/screenshots/
```

## Health Check (While Running)

In another terminal, you can check system health:

```typescript
// Create check-health.ts
import {Orchestrator} from './lib/src/autonomous/orchestrator';

const orchestrator = new Orchestrator({
    baseUrl: 'http://localhost:8065',
    credentials: {username: 'sysadmin', password: 'Sys@dmin-sample1'},
    llmProvider: {type: 'ollama'},
});

const health = await orchestrator.healthCheck();
console.log(JSON.stringify(health, null, 2));
```

## Troubleshooting

### "Ollama is not running"

```bash
# Install Ollama (if not installed)
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama
ollama serve
```

### "Model not found"

```bash
ollama pull deepseek-r1:7b
```

### "Mattermost server not accessible"

- Check if server is running: `curl http://localhost:8065/api/v4/system/ping`
- Verify credentials in `.env`
- Check firewall settings

### "Database locked"

- Only one orchestrator instance can run at a time
- Check for zombie processes: `ps aux | grep autonomous`
- Kill if needed: `pkill -f autonomous`

### TypeScript errors

```bash
# Rebuild TypeScript
cd e2e-tests/playwright
npx tsc --build lib/tsconfig.json
```

## Advanced Usage

### Parallel Execution (3x faster)

```bash
npx tsx lib/src/autonomous/cli.ts \
  --parallel-contexts 3 \
  --max-cycles 10
```

### Continuous Mode (Run forever)

```bash
npx tsx lib/src/autonomous/cli.ts \
  --continuous \
  --cycle-delay 600000  # 10 minutes between cycles
```

### Focus Mode (Test specific area)

```bash
npx tsx lib/src/autonomous/cli.ts \
  --focus "test the emoji picker and reactions"
```

### Spec-Only Mode (Only test what's in spec)

```bash
npx tsx lib/src/autonomous/cli.ts \
  --spec specs/features/messaging.pdf \
  --focus-mode spec-only
```

## Next Steps

1. **Review generated tests** in `specs/autonomous/`
2. **Check knowledge base** for discovered UI states
3. **Run with more cycles** (`--max-cycles 5`) for deeper coverage
4. **Enable parallel execution** (`--parallel-contexts 3`) for faster execution
5. **Set up continuous mode** for ongoing monitoring
