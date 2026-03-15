---
agent: default
description: Analyze which E2E tests are impacted by your current changes
---

Parameters:
- Since ref (optional): git ref to diff against (default: origin/master)
- No AI (optional): set to "yes" to disable AI enrichment and use deterministic-only mode

Steps:

1. Change into the e2e-tests/playwright working directory, then run:
   npx e2e-ai-agents plan --config ./e2e-ai-agents.config.json --since <since-ref>
   (Add --no-ai only if explicitly requested — AI mode is the default when ANTHROPIC_API_KEY is set)

2. Read .e2e-ai-agents/plan.json

3. Present:
   - Decision: safe-to-merge / run-now / must-add-tests
   - Confidence score
   - Each gap: name, priority, reasons, suggested scenarios
   - Covered flows and any advisory scenarios

4. If gaps exist, offer: "Run /playwright-coverage-bridge to generate tests for these gaps."
