---
description: This document contains all development rules and guidelines for this project, applicable to all AI agents (Claude, Cursor, Codex, Gemini, etc.).
alwaysApply: true
---

## 1. Core Principles

- **Small tasks, one at a time**: Always work in baby steps, one at a time. Never go forward more than one step.
- **Test-Driven Development**: Start with failing tests for any new functionality (TDD), according to the task details.
- **Type Safety**: All code must be fully typed.
- **Clear Naming**: Use clear, descriptive names for all variables and functions.
- **Incremental Changes**: Prefer incremental, focused changes over large, complex modifications.
- **Question Assumptions**: Always question assumptions and inferences.
- **Pattern Detection**: Detect and highlight repeated code patterns.

## 2. Language Standards
- **English Only**: All technical artifacts must always use English, including:
    - Code (variables, functions, classes, comments, error messages, log messages)
    - Documentation (README, guides, API docs)
    - Jira tickets (titles, descriptions, comments)
    - Data schemas and database names
    - Configuration files and scripts
    - Git commit messages
    - Test names and descriptions

## 3. Specific standards

For detailed standards and guidelines specific to different areas of the project, refer to:

- [Backend Standards](./backend-standards.md) - API development, database patterns, testing, security and backend best practices
- [Frontend Standards](./frontend-standards.md) - React components, UI/UX guidelines, and frontend architecture
- [Documentation Standards](./documentation-standards.md) - Technical documentation structure, formatting, and maintenance guidelines, including AI standards like this document

## 4. Project Skills

- Skills live in `ai-specs/skills`.
- When a request matches a skill, load and follow the corresponding `SKILL.md` automatically before continuing.
- Also load any referenced files in the skill folder (for example, `references/*.md`) when the skill requires them.

## 5. Symlink Integrity and Multi-Agent Portability

- **Canonical Source**: Keep reusable artifacts in `ai-specs` as the canonical source. Agent-specific paths (such as `.claude` and `.cursor`) should reference them through symlinks when possible.
- **Update Safety**: Whenever a file is renamed, moved, or its suffix changes, verify and update all symlinks that target it before considering the change complete.
- **New Artifact Linking**: Whenever creating a new artifact that requires multi-agent exposure (for example new agents or skills in `ai-specs`), create the corresponding symlinks from the expected agent-specific reference paths.
- **External Customization Review**: Whenever customization is introduced outside `ai-specs`, evaluate whether it should be moved into `ai-specs` and replaced with symlinks from the original locations.
- **Completion Gate**: A change is incomplete if it leaves broken symlinks, stale targets, or duplicated canonical artifacts across agent-specific folders.

## 6. OpenSpec Tasks Mandatory Steps

When creating or updating OpenSpec `tasks.md` artifacts, follow these requirements.

### 6.1 Read OpenSpec configuration first

- **Required first action**: Read `openspec/config.yaml` before drafting or editing any `tasks.md` file.
- **Purpose**: Capture mandatory steps, naming conventions, task structure, testing expectations, and documentation requirements from project configuration.

### 6.2 Required backend task structure

For backend changes, ensure the checklist includes these mandatory steps in order:

1. **Step 0 (must be first)**: Create and switch to feature branch:
   - `feature/[ticket-id]-backend` or `feature/[change-name]-backend`
2. **Review and update existing unit tests (MANDATORY)**
3. **Run unit tests and verify database state (MANDATORY)**
4. **Manual endpoint testing with curl (MANDATORY - AGENT MUST EXECUTE)**
5. **E2E testing with Playwright MCP when applicable (MANDATORY - AGENT MUST EXECUTE)**
6. **Update technical documentation (MANDATORY)**

### 6.3 Manual testing execution is agent responsibility

- **Never delegate testing to the user** for steps required by `tasks.md`.
- The agent must start required services, run tests, validate outcomes, and restore data state after CREATE/UPDATE/DELETE operations.
- The agent must only mark tasks as completed (`[x]`) after required tests pass and cleanup is complete.

### 6.4 Mandatory curl coverage (for endpoint work)

Execute and verify:
- GET endpoints
- POST endpoints (with cleanup)
- PUT/PATCH endpoints (with revert)
- DELETE endpoints (with recreation/restore)
- Error cases (validation, 404, auth as applicable)

Document commands, responses, and restoration actions.

### 6.5 Mandatory Playwright E2E coverage (when applicable)

For frontend workflows or frontend/backend integration changes:
- Run E2E flows with Playwright MCP tools
- Validate success and error paths
- Verify data persistence and consistency
- Clean test data and restore environment state

### 6.6 Completion checklist before finalizing `tasks.md`

- Step 0 branch creation is first
- Mandatory steps are present and sequential
- Mandatory labels are explicit
- Branch name matches backend convention
- Manual testing tasks explicitly state "AGENT MUST EXECUTE"
- Database restoration steps are included for mutating operations
- E2E step is present when frontend workflow impact exists

### 6.7 Mandatory artifact updates for change requests between `/apply` and `/archive`

If a new fix/change is requested after `/apply` and before `/archive`, treat it as a spec update first (never code-only first).

Required order:
1. Update affected OpenSpec artifacts (scenarios, requirements/specs, `tasks.md`).
2. Re-run artifact generation/update step when needed (`/continue`, `/ff`, or equivalent).
3. Implement code only after artifacts reflect the new request.
4. Re-run verification against updated artifacts before archiving.

Do not close this window with direct coding that is not reflected in OpenSpec artifacts.
