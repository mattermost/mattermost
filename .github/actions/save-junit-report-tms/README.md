# Save JUnit Test Report to TMS Action

GitHub Action to save JUnit test reports to Zephyr Scale Test Management System.

## Usage

This action should be used after downloading the test report artifact from a previous workflow run.

```yaml
- name: Download test report artifact
  uses: actions/download-artifact@v4
  with:
    name: mmctl-test-report
    path: ./test-reports

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
| `test-cycle-key` | The created test cycle key in Zephyr Scale |
| `test-cycle-success-count` | Number of successfully saved test executions |
| `test-cycle-failure-count` | Number of failed test execution saves |
| `xml-total-tests` | Total number of tests in the XML report |
| `xml-total-passed` | Number of passed tests in the XML report |
| `xml-total-failed` | Number of failed tests in the XML report |
| `xml-pass-rate` | Pass rate percentage from the XML report |
| `xml-duration` | Total test duration in seconds from the XML report |
| `unique-saved-keys` | Number of unique test keys successfully saved to Zephyr |
| `unique-failed-keys` | Number of unique test keys that failed to save to Zephyr |

## Example Workflow

```yaml
name: mmctl E2E Tests

on:
  workflow_dispatch:
    inputs:
      release-build:
        description: 'Release build version'
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run mmctl tests
        run: |
          # Run your mmctl tests here
          # Generate report.xml

      - name: Upload test report
        uses: actions/upload-artifact@v4
        with:
          name: mmctl-test-report
          path: ./server/report.xml

  save-report:
    needs: test
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/checkout@v4

      - name: Download test report
        uses: actions/download-artifact@v4
        with:
          name: mmctl-test-report
          path: ./test-reports

      - name: Save to Zephyr Scale
        uses: ./.github/actions/save-junit-report-tms
        with:
          report-path: ./test-reports/report.xml
          zephyr-api-key: ${{ secrets.ZEPHYR_API_KEY }}
          build-image: ${{ env.BUILD_IMAGE }}
```

## Local Development

1. Copy `.env.example` to `.env` and fill in your values
2. Run `npm install` to install dependencies
3. Run `npm run local-action` to test locally
4. Run `npm run build` to build for production

## Report Format

The action expects a JUnit XML format report with test case names containing Jira test keys (e.g., `MM-T1234`).

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
