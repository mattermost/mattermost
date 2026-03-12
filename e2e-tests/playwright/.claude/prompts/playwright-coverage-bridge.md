---
agent: default
description: Generate tests for coverage gaps found by e2e-agents impact analysis
---

Parameters:
- Plan path (optional): defaults to `.e2e-ai-agents/plan.json`

Steps:

1. Read <plan-path> and parse the JSON.
   Extract gapDetails[] sorted by priority (P0 first, then P1, then P2).

2. For each gap, construct context from its fields:
   - gap.name — feature area (e.g., "channels/thread-popout")
   - gap.priority — P0/P1/P2
   - gap.reasons[] — why it was flagged
   - gap.files[] — changed source files providing context
   - gap.missingScenarios[] — specific test scenarios to write

3. For each gap, call #playwright-test-planner with prompt:

   <plan>
     <task-text>
       Create E2E tests for "{gap.name}" ({gap.priority}).

       Code changes that triggered this gap:
       {gap.files as bullet list}

       Required test scenarios:
       {gap.missingScenarios as numbered list}

       Analysis: {gap.reasons joined}
     </task-text>
     <seed-file>specs/seed.spec.ts</seed-file>
     <plan-file>specs/{gap.id}-plan.md</plan-file>
   </plan>

4. For each test case in the plan (1.1, 1.2, ...), one at a time,
   call #playwright-test-generator with the standard XML format
   (same pattern as playwright-test-coverage.md).

5. After all test cases for a gap are generated,
   call #playwright-test-healer to fix any failures.

6. Repeat for the next gap.

7. Print summary: gaps addressed, tests generated, tests passing.
