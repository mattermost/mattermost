---
agent: default
description: Find and fill E2E test coverage gaps across the codebase
---

Parameters:
- Scope: "recent" (last 50 commits), "release" (since last tag), or a git ref
- Max gaps (optional): max gaps to generate tests for (default: 3)

Steps:

1. Determine --since ref:
   - "recent": SHA of 50th commit back (git log --oneline -50 | tail -1)
   - "release": latest tag (git describe --tags --abbrev=0)
   - Otherwise: use the provided git ref

2. Run: npx e2e-ai-agents plan --config ./e2e-ai-agents.config.json --since <ref>

3. Read plan.json, sort gaps by priority.

4. Take first <max-gaps> gaps.

5. For each gap, invoke /playwright-coverage-bridge.

6. Print summary: gaps found / addressed / tests generated / tests passing.
