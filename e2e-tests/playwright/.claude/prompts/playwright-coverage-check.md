---
agent: default
description: Check E2E coverage for your changes and generate missing tests
---

Parameters:
- Since ref (optional): defaults to origin/master
- Auto-generate (optional): "yes" to generate tests for gaps without asking

Steps:

1. Change into the e2e-tests/playwright working directory, then run:
   npx e2e-ai-agents plan --config ./e2e-ai-agents.config.json --since <since-ref>

2. Read e2e-tests/playwright/.e2e-ai-agents/plan.json

3. If decision is "safe-to-merge":
   Print covered flows summary. Done.

4. If decision is "run-now":
   Print recommended test files to run.
   If advisoryScenarios exist, mention them as optional enhancements.

5. If decision is "must-add-tests":
   Print gap summary with priority and scenarios.
   If auto-generate or user confirms:
     Invoke /playwright-coverage-bridge with the plan path
       (e2e-tests/playwright/.e2e-ai-agents/plan.json).
   Otherwise print gaps for manual action.
