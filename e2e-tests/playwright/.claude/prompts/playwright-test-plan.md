---
agent: playwright-test-planner
description: Create test plan
---

Parameters:
- scenario_description: description of the feature/flow to plan tests for
- seed_file (optional): seed file path (default: `specs/seed.spec.ts`)
- test_plan_file (optional): output plan file path (default: `specs/coverage.plan.md`)

Create test plan for "{{scenario_description}}" functionality.

- Seed file: `{{seed_file}}`
- Test plan: `{{test_plan_file}}`
