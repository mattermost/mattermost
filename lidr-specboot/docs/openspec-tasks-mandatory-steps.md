---
description: Enforce mandatory steps from openspec/config.yaml when creating tasks.md artifacts and ensure agent executes all manual tests
alwaysApply: true
---

# OpenSpec Tasks: Mandatory Steps Enforcement

When creating or updating `tasks.md` artifacts in OpenSpec changes, you MUST:

## 1. Read openspec/config.yaml First

**BEFORE** creating or updating any `tasks.md` file, you MUST read `openspec/config.yaml` to understand:
- Backend and frontend-specific mandatory steps
- Branch naming conventions
- Task structure requirements
- Testing and documentation requirements

## 2. Mandatory Steps

All implementation tasks MUST include these steps in the correct order:

### Step 0: Create Feature Branch (MUST BE FIRST)
- **Location**: Must be the very first step (Step 0)
- **Branch naming**: `feature/[ticket-id]` or `feature/[change-name]`
- **Action**: Create and switch to feature branch before any code changes

### Mandatory Steps (Must Be Included):
- **Step N**: Review and Update Existing Unit Tests (MANDATORY)
- **Step N+1**: Run Unit Tests and Verify Database State (MANDATORY)
- **Step N+2**: Manual Endpoint Testing with curl (MANDATORY) - **AGENT MUST EXECUTE**
- **Step N+3**: E2E Testing with Playwright MCP (MANDATORY if applicable) - **AGENT MUST EXECUTE**
- **Step N+4**: Update Technical Documentation (MANDATORY)

## 3. Manual Testing Requirements - CRITICAL: Agent Must Execute

**IMPORTANT**: The coding agent (AI) MUST perform all manual testing steps itself. **NEVER delegate testing to the user**. These tests must be executed by the agent to mark tasks as completed in `tasks.md`.

### Step N+1: Run Unit Tests and Verify Database State (MANDATORY)

**Agent Responsibility**: The coding agent MUST execute unit tests, validate database integrity before/after execution, and produce a test report artifact in the change spec folder. This is NOT optional and cannot be delegated to the user.

**Implementation Steps** (Agent must perform):
1. **Prepare Test Environment**:
   - Ensure required services are available (database, cache, dependencies)
   - Capture pre-test database state relevant to the change (counts, key records, checksums, or snapshots)
   - Document the exact test command(s) that will be executed

2. **Run Targeted Unit Tests First**:
   - Execute focused tests for the modified module(s) and related behavior
   - Confirm failures are resolved and no new regressions appear in targeted scope
   - Capture command output summary (passed/failed/skipped)

3. **Run Broader Unit Test Suite**:
   - Execute the project/unit suite required by `openspec/config.yaml` (or justified subset if configured)
   - Record total test counts, failures, runtime, and any flaky behavior observed

4. **Verify Post-Test Database State**:
   - Re-check the same database indicators captured before tests
   - Confirm no unintended mutations remain after tests complete
   - If any mutation occurred, restore state and document the restoration

5. **Create Unit Test Verification Report in Spec Folder**:
   - Save report under the current change folder in `specs/<change-name>/reports/`
   - Use this filename pattern: `YYYY-MM-DD-step-N+1-unit-test-and-db-verification.md`
   - Include executed commands, summarized results, database pre/post comparison, and cleanup actions

6. **Mark Task as Completed**: Only after unit tests pass (or approved exceptions are documented), database state is verified/restored, and the report file is created, mark Step N+1 as completed in `tasks.md`.

**Report Template** (store in `specs/<change-name>/reports/`):
```markdown
# Step N+1 Report - Unit Tests and Database Verification

- Date: YYYY-MM-DD
- Change: <change-name>
- Agent: <agent-name>

## Commands Executed
- `<command 1>`
- `<command 2>`

## Unit Test Results
- Targeted tests: X passed, Y failed, Z skipped
- Full/required suite: X passed, Y failed, Z skipped
- Runtime: <duration>
- Notes: <flaky tests, retries, exceptions>

## Database State Verification
- Pre-test baseline:
  - <metric/table/check>: <value>
- Post-test validation:
  - <metric/table/check>: <value>
- State restored: Yes/No
- Restoration actions (if any): <actions>

## Outcome
- Step N+1 status: PASS/FAIL
- Blocking issues: <none or list>
```

**Dependencies**:
- Test runner and project test dependencies installed
- Database access for state verification/restoration
- Permission to create report files in `specs/<change-name>/reports/`

**Notes**:
- **The agent MUST execute tests itself** - never ask the user to run tests
- This step is mandatory even when code changes look small
- Report naming must follow the required pattern for traceability
- **Task completion in tasks.md can only be marked after report creation**

### Step N+2: Manual Endpoint Testing with curl (MANDATORY)

**Agent Responsibility**: The coding agent MUST execute all curl commands and verify responses. This is NOT optional and cannot be delegated to the user.

**Implementation Steps** (Agent must perform):
1. **Prepare Test Environment**:
   - Ensure the backend server is running (start if needed)
   - Verify database connection is active
   - Note the current database state (if testing CREATE/UPDATE/DELETE endpoints)

2. **Test GET Endpoints** (if any):
   - Create curl command to test GET endpoint
   - Execute curl command: `curl -X GET [endpoint-url] [headers]`
   - Verify response status code (200, 404, etc.)
   - Verify response body structure and content
   - Document the curl command and response in the task completion

3. **Test POST Endpoints** (CREATE operations):
   - Create curl command with request body: `curl -X POST [endpoint-url] -H "Content-Type: application/json" -d '[json-body]'`
   - Execute curl command and capture response
   - Verify response status code (201, 400, 422, etc.)
   - Verify response body contains created resource
   - **Restore Database State**: After testing, delete the created record to restore database to original state
   - Document the curl command, response, and cleanup action

4. **Test PUT/PATCH Endpoints** (UPDATE operations):
   - Create curl command with updated data: `curl -X PUT [endpoint-url] -H "Content-Type: application/json" -d '[json-body]'`
   - Execute curl command and capture response
   - Verify response status code (200, 404, 400, etc.)
   - Verify response body contains updated resource
   - **Restore Database State**: After testing, revert the updated record to its original values to restore database state
   - Document the curl command, response, and cleanup action

5. **Test DELETE Endpoints**:
   - Create curl command: `curl -X DELETE [endpoint-url]`
   - Execute curl command and capture response
   - Verify response status code (200, 204, 404, etc.)
   - Verify deletion was successful
   - **Restore Database State**: After testing, recreate the deleted record with original values to restore database state
   - Document the curl command, response, and cleanup action

6. **Test Error Cases**:
   - Test with invalid data (validation errors)
   - Test with non-existent resources (404 errors)
   - Test with unauthorized access (if applicable)
   - Verify error response format matches API specification

7. **Mark Task as Completed**: Only after all curl tests pass and database state is restored, mark the task as completed in `tasks.md`

**Dependencies**:
- Backend server running (agent must start if needed)
- Database access for state restoration
- curl command-line tool

**Notes**:
- This step is MANDATORY for all new endpoints
- **The agent MUST execute all curl commands itself** - never ask the user to run tests
- All CREATE/UPDATE/DELETE operations must restore database to original state after testing
- Document all curl commands and responses for future reference in a report in the spec folder with proper naming
- Verify that database state matches pre-test state after cleanup
- Do not skip manual testing even if unit tests pass
- **Task completion in tasks.md can only be marked after successful execution of all curl tests**

### Step N+3: E2E Testing with Playwright MCP (MANDATORY if applicable)

**Agent Responsibility**: The coding agent MUST execute all E2E tests using Playwright MCP tools. This is NOT optional and cannot be delegated to the user.

**When This Applies**:
- Frontend changes that affect user workflows
- Integration between frontend and backend endpoints
- User-facing features that require browser interaction

**Implementation Steps** (Agent must perform):
1. **Prepare Test Environment**:
   - Ensure both frontend and backend servers are running (start if needed)
   - Verify database is in a known state
   - Check available Playwright MCP tools using MCP file system

2. **Navigate to Application**:
   - Use Playwright MCP `browser_navigate` to open the application URL
   - Wait for page to load completely
   - Take a snapshot to verify initial state

3. **Execute User Workflows**:
   - Use Playwright MCP tools to interact with the UI:
     - `browser_click` for button clicks and navigation
     - `browser_type` or `browser_fill` for form inputs
     - `browser_snapshot` to verify state changes
     - `browser_wait` for async operations
   - Test the complete user workflow from start to finish
   - Verify expected outcomes at each step

4. **Test Error Scenarios**:
   - Test form validation errors
   - Test error messages display correctly
   - Test error recovery flows

5. **Verify Data Persistence**:
   - After creating/updating data through UI, verify it persists correctly
   - Check database state matches UI state
   - Verify data appears correctly in lists/details views

6. **Restore Test Environment**:
   - Clean up any test data created during E2E tests
   - Restore database to original state
   - Close browser sessions

7. **Mark Task as Completed**: Only after all E2E tests pass and environment is restored, mark the task as completed in `tasks.md`

**Dependencies**:
- Frontend server running (agent must start if needed)
- Backend server running (agent must start if needed)
- Playwright MCP tools available
- Database access for verification and cleanup

**Notes**:
- **The agent MUST execute all E2E tests itself** - never ask the user to run tests
- Use incremental waits (1-3 seconds) with snapshot checks rather than long waits
- Always restore database state after tests that modify data
- Document test scenarios and outcomes in a report in the spec folder with proper naming
- **Task completion in tasks.md can only be marked after successful execution of all E2E tests**

## 4. Verification Checklist

Before finalizing any `tasks.md` file, verify:
- [ ] Step 0 (Create Feature Branch) is the FIRST step
- [ ] All mandatory steps from config.yaml are included
- [ ] Steps are numbered sequentially
- [ ] Mandatory steps are clearly marked with "(MANDATORY)" label
- [ ] Branch naming follows the convention: `feature/[name]-backend`
- [ ] Step N+1 includes report path and naming convention in `specs/<change-name>/reports/`
- [ ] Manual testing steps explicitly state "AGENT MUST EXECUTE"
- [ ] Tasks include database state restoration steps
- [ ] E2E testing step is included if frontend changes are involved

## 5. When This Applies

This rule applies when:
- Creating `tasks.md` via `/opsx:ff` (fast-forward) or `openspec-ff-change` skill
- Creating `tasks.md` via `/opsx:continue` (continue change) or `openspec-continue-change` skill
- Updating existing `tasks.md` files
- Any task creation that involves backend changes
- Implementing tasks from `tasks.md` via `/opsx:apply` or `openspec-apply-change` skill - the agent must execute manual tests

## 6. Example Structure

```markdown
## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/update-position-backend` from main/master branch
- [ ] 0.2 Verify branch creation and current branch status

## 1. Backend: Validator Tests (TDD)
...

## 8. Backend: Review and Update Existing Unit Tests (MANDATORY)
...

## 9. Backend: Run Unit Tests and Verify Database State (MANDATORY)
- [ ] 9.1 Capture pre-test database baseline for impacted entities
- [ ] 9.2 Run targeted unit tests for changed modules
- [ ] 9.3 Run required broader unit test suite from config
- [ ] 9.4 Verify post-test database state and restore if needed
- [ ] 9.5 Create report `specs/<change-name>/reports/YYYY-MM-DD-step-N+1-unit-test-and-db-verification.md`
- [ ] 9.6 Mark step complete only after tests pass and report exists

## 10. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)
- [ ] 10.1 Ensure backend server is running
- [ ] 10.2 Test GET endpoints with curl and verify responses
- [ ] 10.3 Test POST endpoints with curl, verify creation, then restore database state
- [ ] 10.4 Test PUT/PATCH endpoints with curl, verify updates, then restore database state
- [ ] 10.5 Test DELETE endpoints with curl, verify deletion, then restore database state
- [ ] 10.6 Test error cases (validation errors, 404, etc.)
- [ ] 10.7 Document all curl commands and responses
- [ ] 10.8 Verify database state matches pre-test state

## 11. Frontend: E2E Testing with Playwright MCP (MANDATORY if applicable - AGENT MUST EXECUTE)
- [ ] 11.1 Ensure frontend and backend servers are running
- [ ] 11.2 Navigate to application using Playwright MCP browser_navigate
- [ ] 11.3 Execute complete user workflow using Playwright MCP tools
- [ ] 11.4 Test error scenarios and validation
- [ ] 11.5 Verify data persistence and UI state
- [ ] 11.6 Restore test environment and database state
- [ ] 11.7 Document test scenarios and outcomes

## 16. Update Technical Documentation (MANDATORY)
...
```

## 7. Agent Execution Requirements

**CRITICAL**: When implementing tasks from `tasks.md` (via `openspec-apply-change` skill or `/opsx:apply` command), the coding agent MUST:

1. **Execute All Manual Tests**: Never ask the user to run curl commands or E2E tests. The agent must:
   - Start servers if needed (backend, frontend)
   - Execute all curl commands for endpoint testing
   - Execute all E2E tests using Playwright MCP tools
   - Verify all responses and outcomes
   - Restore database state after tests

2. **Mark Tasks as Completed**: Tasks can ONLY be marked as completed (`[x]`) in `tasks.md` AFTER:
   - The agent has successfully executed all required tests
   - All test results have been verified
   - Database state has been restored (for CREATE/UPDATE/DELETE operations)
   - All test outcomes have been documented

3. **Never Delegate Testing**: The agent must never:
   - Ask the user to run curl commands
   - Ask the user to test endpoints manually
   - Ask the user to run E2E tests
   - Mark tasks as completed without executing tests
   - Skip manual testing steps

4. **Document Test Execution**: The agent must document:
   - All curl commands executed
   - All responses received
   - All E2E test scenarios executed
   - Database state restoration actions
   - Any issues encountered and resolutions

## Failure to Follow

If you create tasks without following these mandatory steps, the user will need to manually fix the tasks.md file. Always read `openspec/config.yaml` first and ensure all mandatory steps are included.

**If you implement tasks without executing manual tests yourself, you are violating this rule. The agent must execute all tests to mark tasks as completed.**
