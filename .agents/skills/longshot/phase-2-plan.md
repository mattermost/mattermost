# Phase 2: Plan

**Goal**: Produce an approved implementation plan saved to file.

Follow the `conductor:track-management` skill for plan structure (see conductor's `templates/track-plan.md`), or fall back to `superpowers:writing-plans`:

### Step 2.1: Research Codebase
Spawn an **Explore** agent to find:
- 2-3 similar features with `file:line` references
- Patterns they follow
- Current state gaps

### Step 2.2: Domain Consultation (skip with `--minimal`)
Use three-level agent discovery. Route by affected layers from Phase 1:

| Layer/Domain | Agents to Consult |
|-------------|-------------------|
| Database/migrations | `database-architecture-reviewer`, `db-migration` |
| Permissions/auth | `permission-design-auditor`, `permission-auditor` |
| API design | `api-contract-reviewer`, `api-reviewer` |
| Frontend/React | `react-frontend`, `redux-expert`, `component-reviewer` |
| System design | `system-design-reviewer` |
| Caching | `caching-strategist` |

Prompt each agent with research findings + feature requirements for advisory input (patterns, constraints, mistakes to avoid).

When **swarm mode** is available, spawn these in parallel as a team. Otherwise, serial subagent calls.

### Step 2.3: Draft Plan
Use the profile's plan template (see conductor's `templates/track-plan.md` for the base structure). For **Mattermost**: structure phases by layers (Model → Store → App → API → Webapp) with tasks per layer. For **Generic**: structure phases by component/module with tasks per area. Incorporate domain agent advice.

**Test Plan Section (MANDATORY)**: Every plan MUST include a `## Test Plan` section with the following subsections. Phase 4 uses this as its test specification.

```markdown
## Test Plan

### Unit Tests
- **Files to test**: List functions/modules that need unit test coverage with file paths
- **Test files**: Spec files to create or modify (e.g., `server/channels/app/foo_test.go`, `webapp/channels/src/components/foo.test.tsx`)
- **Key scenarios**: Happy path, error cases, edge cases, boundary conditions
- **Mocking needs**: What needs to be mocked (DB, API calls, external services)

### E2E Tests
- **Framework**: Playwright / Cypress / N/A (with justification)
- **Coverage map**: Which acceptance criteria are covered by E2E tests
- **Test files**: E2E spec files to create or modify, with file paths (e.g., `e2e-tests/playwright/tests/foo.spec.ts`)
- **User flows**: End-to-end flows to test — describe the steps (navigate, click, fill, verify)
  - Happy path flow(s)
  - Error state flow(s)
  - Edge case flow(s)
- **Selectors**: `data-testid` attributes that need to be added to implementation code
- **Cypress-specific**: If using Cypress, note which `cy.api*` calls are for SETUP ONLY vs which flows must go through the UI (see Phase 4 E2E guidelines)
- **Skip justification**: If E2E tests are genuinely not applicable (e.g., pure backend/CLI change with no UI surface), document WHY with specifics — "not applicable" alone is insufficient

### Integration Tests (if multi-layer)
- **Cross-layer boundaries**: Which layer interfaces need integration testing (e.g., Store ↔ API, App ↔ DB)
- **Test files**: Integration test files to create/modify
- **Contract tests**: API request/response contracts to verify

### Regression Tests
- **Related features**: List 3-5 features/workflows that depend on changed code
- **Critical paths**: User workflows that must remain unbroken after this change
- **Backwards compatibility**: API/schema changes that could break existing clients

### Test Data Management
- **Seed strategy**: How test data is created — factory functions, fixtures, or setup API calls (not shared global mutable state)
- **Test isolation**: Each test MUST be able to run independently and in any order; no test may depend on state created by another test
- **Teardown**: How data is cleaned up — afterEach/defer cleanup, ephemeral test DB, or transaction rollback
- **Prohibition**: Hard-code NO shared state between tests. Tests that pass individually but fail in sequence are a data isolation failure.
```

This prevents testing from being deferred or forgotten during implementation.

### Step 2.4: Devil's Advocate Review (skip with `--minimal`)
Before validating the plan, actively challenge it from opposing perspectives:

- **Simpler alternative**: Is there a way to achieve 80% of this with 20% of the complexity? Could we reuse an existing feature, pattern, or library instead of building from scratch?
- **Over-engineering check**: Are we adding abstractions, indirections, or configurability that aren't justified by the current requirements? Would a simpler, more direct approach work?
- **Alternative architectures**: Could this be done server-side instead of client-side (or vice versa)? Could a different data model eliminate complexity? Would a different API shape simplify the frontend?
- **Cost of change**: What's the blast radius? How many files, tests, and docs does this touch? Is there a phasing that reduces risk?
- **What if we don't build this?**: What's the workaround? Is the pain real enough to justify the investment?

Document any viable alternatives as a "## Alternatives Considered" section in the plan with a brief rationale for the chosen approach.

Principle citation: [rules.md §8](rules.md#8-principle-applications) — iteration is cheap; if two approaches seem viable, prototype the riskier parts of each before committing.

### Step 2.5: Completeness Check (skip with `--minimal`)
Spawn a **fast/lightweight** agent to verify all required template sections are present and non-empty. Fix gaps before proceeding.

### Step 2.6: Assertion Check (skip with `--minimal`)
Spawn `plan-assertion-checker` agent (if available in agents directory) to verify factual claims against codebase. Fix MUST_FIX items.

### Step 2.7: Plan Review
Spawn plan review agents:
- Always: `design-flaw-finder`, `simplicity-reviewer`
- By domain: route additional reviewers per affected layers

**Verdicts**:
- **READY** (0 MUST_FIX): proceed to Phase 3
- **NEEDS WORK** (1-2 MUST_FIX): fix and re-review
- **MAJOR REVISION** (3+ MUST_FIX): STOP per [rules.md §6](rules.md#6-stop-protocol) — present plan + findings to user

Iteration budget: 2 rounds ([rules.md §4](rules.md#4-retry--escalation-budgets)).

### Step 2.8: Save
Save plan to `<artifact_dir>/plan.md`. Update state.json per [rules.md §1.5](rules.md#15-statejson-update-ritual). Record checkpoint commit SHA per [rules.md §1.6](rules.md#16-checkpoint-commits-at-gates).

---
