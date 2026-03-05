# Save JUnit Test Report to TMS Action

GitHub Action to save JUnit test reports to Zephyr Scale Test Management System.

## Usage

```yaml
- name: Save JUnit test report to Zephyr
  uses: ./.github/actions/save-junit-report-tms
  with:
    report-path: ./test-reports/report.xml
    zephyr-api-key: ${{ secrets.ZEPHYR_API_KEY }}
    build-image: ${{ env.BUILD_IMAGE }}
    zephyr-folder-id: '27504432'  # Optional, defaults to 27504432
    jira-project-key: 'MM'  # Optional, defaults to MM
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `report-path` | Path to the XML test report file (from artifact) | Yes | - |
| `zephyr-api-key` | Zephyr Scale API key | Yes | - |
| `build-image` | Docker build image used for testing | Yes | - |
| `zephyr-folder-id` | Zephyr Scale folder ID | No | `27504432` |
| `jira-project-key` | Jira project key | No | `MM` |

## Outputs

| Output | Description |
|--------|-------------|
| `test-cycle` | The created test cycle key in Zephyr Scale |
| `test-keys-execution-count` | Total number of test executions (including duplicates) |
| `test-keys-unique-count` | Number of unique test keys successfully saved to Zephyr |
| `junit-total-tests` | Total number of tests in the JUnit XML report |
| `junit-total-passed` | Number of passed tests in the JUnit XML report |
| `junit-total-failed` | Number of failed tests in the JUnit XML report |
| `junit-pass-rate` | Pass rate percentage from the JUnit XML report |
| `junit-duration-seconds` | Total test duration in seconds from the JUnit XML report |

## Local Development

1. Copy `.env.example` to `.env` and fill in your values
2. Run `npm install` to install dependencies
3. Run `npm run pretter` to format code
4. Run `npm test` to run unit tests
5. Run `npm run local-action` to test locally
6. Run `npm run build` to build for production

### Submitting Code Changes

**IMPORTANT**: When submitting code changes, you must run the following checks locally as there are no CI jobs for this action:

1. Run `npm run prettier` to format your code
2. Run `npm test` to ensure all tests pass
3. Run `npm run build` to compile your changes
4. Include the updated `dist/` folder in your commit

GitHub Actions runs the compiled code from the `dist/` folder, not the source TypeScript files. If you don't include the built files, your changes won't be reflected in the action.

## Report Format

The action expects a JUnit XML format report with test case names containing Zephyr test keys in the format `{PROJECT_KEY}-T{NUMBER}` (e.g., `MM-T1234`, `FOO-T5678`).

The test key pattern is automatically determined by the `jira-project-key` input (defaults to `MM`).

Example:
```xml
<testsuites tests="10" failures="2" errors="0" time="45.2">
  <testsuite name="mmctl tests" tests="10" failures="2" time="45.2" timestamp="2024-01-01T00:00:00Z">
    <testcase name="MM-T1234 - Test user creation" time="2.5"/>
    <testcase name="MM-T1235 - Test user login" time="3.2">
      <failure message="Login failed"/>
    </testcase>
  </testsuite>
</testsuites>
```
