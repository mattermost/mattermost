---
name: test-quality-reviewer
description: Evaluate the quality and efficacy of existing tests by reviewing test code against source code. Use when the user asks to review tests, validate test quality, audit test suites, check test efficacy, or assess whether tests are testing things properly. Prioritizes real interactions over mocking and simulation.
---

# Test Quality Reviewer

Review existing tests for efficacy, correctness, and coverage gaps. The goal is not to run tests — it is to evaluate whether the tests are **actually testing what they claim to test**, and whether they do so in a meaningful way.

## Core Philosophy

A good test exercises real behavior. A bad test creates an elaborate illusion of safety. When evaluating tests, apply these principles in priority order:

1. **Real over simulated** — Tests should call real functions, click real elements, make real HTTP requests against real (or at minimum realistic) servers. If a test replaces the thing-under-test with a fake, it tests nothing.
2. **Fewer mocks, more integration** — Mocking is acceptable at true system boundaries (third-party APIs, payment processors). Mocking your own code is almost always a smell. If a unit test mocks three internal interfaces just to test one function, it is fragile and low-value.
3. **Assertions on outcomes, not implementation** — Good tests assert on what happened (the row exists in the DB, the element is visible, the response body contains X). Bad tests assert on how it happened (function Y was called with args Z).
4. **Tests should break when behavior breaks** — If you can change the implementation in a way that introduces a bug and the test still passes, the test is worthless.

## Evaluation Workflow

When the user points you at tests to review, follow these steps:

### Step 1: Read the tests

Read all test files the user specifies. For each test case, note:
- What it claims to test (name / comments)
- What it actually exercises
- What it asserts

### Step 2: Read the source code under test

Identify the production code that the tests target. Read it thoroughly. You need to understand the real behavior to judge whether the tests cover it.

### Step 3: Evaluate each test

For every test case, assess:

| Criterion | What to look for |
|-----------|-----------------|
| **Efficacy** | Does the test exercise real behavior or just verify mock wiring? |
| **Assertion quality** | Are assertions on meaningful outcomes or implementation details? |
| **Mock abuse** | Is anything mocked that could reasonably be used directly? Are internal interfaces mocked? |
| **Brittleness** | Will the test break on harmless refactors but survive actual bugs? |
| **Clarity** | Can you tell what breaks if this test fails? |
| **Redundancy** | Does this test duplicate coverage from another test without adding value? |

### Step 4: Identify coverage gaps

Compare the source code against the full test suite. Look for:
- Public functions / methods with no test coverage
- Important code paths (error handling, edge cases, branching logic) not exercised
- Integration points that are only tested in isolation via mocks
- User-facing flows with no E2E coverage

### Step 5: Produce the report

Output the report using the format defined below.

## Output Format

### Test Evaluation Table

Produce a markdown table with one row per test case:

| Test Name | What It Tests | Verdict | Issues / Suggestions |
|-----------|--------------|---------|---------------------|
| `TestCreateUser` | Inserts a user row and verifies DB state | Good | — |
| `TestHandleWebhook` | Mocks the HTTP client and checks mock was called | Remove or rewrite | Mocks the entire HTTP layer; never validates actual webhook processing. Rewrite to send a real HTTP request to a test server. |
| `TestParseConfig` | Parses valid and invalid YAML | Good, improve | Add cases for missing required fields and malformed YAML. |

**Verdict values:**
- **Good** — The test is effective and worth keeping as-is.
- **Good, improve** — Fundamentally sound but has specific gaps or minor issues.
- **Rewrite** — The test has the right idea but the approach undermines its value (e.g. over-mocking).
- **Remove or rewrite** — The test provides false confidence; it should be deleted or completely rethought.

### Coverage Gap Analysis

After the table, add a section listing recommended new tests:

```markdown
## Coverage Gaps

### Missing test coverage

| Source Code Area | What Needs Testing | Suggested Approach |
|-----------------|-------------------|-------------------|
| `server/api.go:HandleDelete` | No tests for the delete endpoint | Integration test: call the endpoint with a real HTTP request, verify the resource is removed from the DB |
| `webapp/src/components/Modal.tsx` | Modal close behavior untested | E2E test: open modal, click close button, assert modal is no longer in DOM |
```

## Language & Framework Guidance

Apply these heuristics based on what you observe in the test code:

### Go tests

- **Good**: Tests that spin up real servers (`httptest.NewServer`), use real database connections (even SQLite in-memory), call exported functions directly.
- **Bad**: Tests that define mock interfaces for every dependency. If a function takes an `io.Reader`, pass a `strings.NewReader` — don't create a `MockReader`.
- **Smell**: Any file with more mock type definitions than test functions.
- **Table-driven tests** are preferred — but only when the table entries actually vary behavior. A table test with 20 rows that all exercise the same code path is noise.

### Playwright / E2E tests

- **Good**: Tests that navigate to real pages, click real buttons, fill real forms, and assert on visible outcomes.
- **Bad**: Tests that intercept every network request with `page.route()` and only verify mocked responses rendered. The point of E2E is end-to-end.
- **Smell**: Tests that never wait for real data or real side effects. If the test completes in <100ms, it probably didn't test anything real.
- **Key question**: If the backend broke, would this test catch it?

### React / frontend component tests

- **Good**: Tests that render components with realistic props and assert on DOM output. Tests that simulate user interactions (clicks, input) and verify resulting UI changes.
- **Bad**: Tests that mock every hook, every context provider, and every child component. If you mock everything around a component, you're testing an empty shell.
- **Smell**: Tests that assert on internal state rather than rendered output. Users don't see state — they see UI.
- **Key question**: If someone changed the component's visible behavior, would this test fail?

### API / HTTP handler tests

- **Good**: Tests that construct real HTTP requests, send them through the actual router/middleware stack, and assert on response codes, headers, and body content.
- **Bad**: Tests that call handler functions directly with fabricated context objects, bypassing middleware, auth, and routing.
- **Smell**: Tests that mock the database layer and only check that `db.Insert` was called. That tests nothing about whether the insert works or the data is correct.
- **Key question**: If the API contract changed (response shape, status code, headers), would this test catch it?

## Anti-Patterns Cheat Sheet

Flag any of these immediately:

| Anti-Pattern | Why It's Bad | What To Recommend Instead |
|-------------|-------------|--------------------------|
| Mocking your own interfaces | Tests the mock, not the code | Use the real implementation or a lightweight fake (e.g. in-memory DB) |
| `assert(mockFn).toHaveBeenCalledWith(...)` as the only assertion | Verifies wiring, not behavior | Assert on the actual outcome (DB state, HTTP response, DOM output) |
| `page.route('**/*', ...)` in E2E tests | Defeats the purpose of E2E | Let real requests flow; mock only true external services if needed |
| Snapshot tests as sole coverage | Snapshots are approvals, not assertions | Add explicit assertions for key behaviors; use snapshots only for regression on stable output |
| Testing private/internal methods directly | Couples tests to implementation | Test through the public API |
| Giant setup / teardown with no assertions | Complexity without value | Simplify setup; each test should have clear, specific assertions |
| Tests that pass when the feature is deleted | Zero coupling to real behavior | Rewrite to depend on actual feature code |
