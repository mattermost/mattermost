---
agent: playwright-test-generator
description: Generate tests from a plan
---

Parameters:
- bulletId: the test plan bullet to generate (e.g., "1.1 Add item to cart")
- planPath: path to the test plan file (e.g., "specs/coverage.plan.md")

Generate tests for the test plan's bullet {{bulletId}}.

Test plan: `{{planPath}}`
