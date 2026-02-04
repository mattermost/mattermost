---
date: 2026-02-04T02:46:03-05:00
researcher: Claude
git_commit: 1112e63e8812cbc49e9d9df95042ee8c7eeda724
branch: master
repository: mattermost-extended
topic: "Fix Test Isolation Errors in GitHub Actions"
tags: [testing, status-logs, api-tests, test-isolation]
status: in-progress
last_updated: 2026-02-04
last_updated_by: Claude
type: bugfix
---

# Handoff: Fix Test Isolation Errors in GitHub Actions

## Task(s)
**Status: In Progress**

Fixing test failures from GitHub Actions run: https://github.com/stalecontext/mattermost-extended/actions/runs/21662672470/job/62450704653

### Issues Identified:
1. **Platform Tests - Status Logs** (FIXED): Tests were failing because status logs accumulated across tests. Each test expected a clean slate but inherited logs from previous tests.

2. **API Tests - Preference Override** (NOT STARTED): Tests failing with "Received unexpected error" - needs investigation.

3. **API Tests - Status Extended** (NOT STARTED): `TestMultiUserStatusScenario` and `TestWebSocketStatusEvents` failing - needs investigation.

## Critical References
- Test workflow: `.github/workflows/test.yml`
- Status logs test file: `server/channels/app/platform/status_logs_test.go`
- Platform test helper: `server/channels/app/platform/helper_test.go`

## Recent changes
- `server/channels/app/platform/helper_test.go:96-99`: Added `th.Service.ClearStatusLogs()` call in `InitBasic()` function to clear status logs before each test, ensuring test isolation.

## Learnings
1. **Test Isolation Issue**: The platform tests share a database when running in parallel mode. Each test gets a new store object via `mainHelper.GetNewStores(tb)`, but they all point to the same underlying database. Status logs from one test remain visible to subsequent tests.

2. **Proper Fix Location**: Instead of adding cleanup to every individual test (which is tedious and error-prone), the cleanup should be added to the shared `InitBasic()` function in `helper_test.go` which all tests call.

3. **Pattern Recognition**: The error messages showed accumulating counts (1 item, then 2 items, then 3 items, etc.) which is a clear sign of test isolation problems - data persisting between tests.

4. **API Test Failures**: The preference override tests are failing with "Received unexpected error" at lines 118, 150, 172, 203 in `preference_override_test.go`. These need separate investigation - likely the feature flag or override logic is not working as expected.

## Artifacts
- `server/channels/app/platform/helper_test.go:96-99` - Modified to add ClearStatusLogs() call

## Action Items & Next Steps
1. **Verify Platform Fix**: Run the platform tests locally to confirm the `ClearStatusLogs()` fix works:
   ```bash
   ./tests.bat status
   ```

2. **Investigate API Test Failures**: Look at `server/channels/api4/preference_override_test.go:118,150,172,203` to understand why the preference override tests are failing. The tests expect errors (403 Forbidden) when users try to change overridden preferences, but are receiving unexpected errors instead.

3. **Check Status Extended API Tests**: Investigate `TestMultiUserStatusScenario` and `TestWebSocketStatusEvents` failures - these may be timing-related or require similar isolation fixes.

4. **Run Full Test Suite**: After fixes, run `./tests.bat` to verify all tests pass before committing.

5. **Commit and Push**: Once tests pass, commit the changes and push to trigger a new GitHub Actions run.

## Other Notes
- The failed run URL: https://github.com/stalecontext/mattermost-extended/actions/runs/21662672470/job/62450704653
- The `setupDBStore()` function in `helper_test.go:67-84` handles database setup differently based on `RunParallel` mode
- When running in parallel mode, `DropAllTables()` is NOT called - tests share the same database
- The webapp tests also had some failures (encryption utility tests, status log dashboard tests) that may need investigation
