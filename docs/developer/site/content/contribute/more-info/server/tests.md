---
title: "Tests"
heading: "Server test guidelines"
description: "Guidelines to write golang server tests"
date: 2025-02-05T18:00:00-04:00
weight: 2
aliases:
  - /contribute/server/tests
---

## Handling Flaky Tests

A flaky test is one that exhibits both passing and failing results when run multiple times without any code changes. When our automation detects a flaky test on your PR:

1. **Check if the Test is Newly Introduced**
   - Review your PR changes to determine if the flaky test was introduced by your changes
   - If the test is new, fix the flakiness in your PR before merging

2. **For Existing Flaky Tests**
   - Create a JIRA ticket titled "Flaky Test: {TestName}", e.g. "Flaky Test: TestGetMattermostLog"
   - Copy the test failure message into the JIRA ticket description
   - Add the `flaky-test` and `triage-global` labels
   - Create a PR to skip the test by adding:

     ```go
     t.Skip("https://mattermost.atlassian.net/browse/MM-XXXXX")
     ```

     where MM-XXXXX is your JIRA ticket number
   - Link the JIRA ticket in the skip message for tracking

This process helps us track and systematically address flaky tests while preventing them from blocking development work.

## Writing Parallel Tests

Leveraging parallel tests can drastically reduce execution time for entire test packages, such as [`api4`](https://github.com/mattermost/mattermost/tree/master/server/channels/api4) and [`app`](https://github.com/mattermost/mattermost/tree/master/server/channels/app), which are notably heavy with hundreds of tests. However, careful implementation is essential to ensure reliability and prevent flakiness. Follow these guidelines when writing parallel tests:

### Enabling Parallel Tests

In [`api4`](https://github.com/mattermost/mattermost/tree/master/server/channels/api4), [`app`](https://github.com/mattermost/mattermost/tree/master/server/channels/app), [`platform`](https://github.com/mattermost/mattermost/tree/master/server/channels/app/platform), [`email`](https://github.com/mattermost/mattermost/tree/master/server/channels/app/email), [`jobs`](https://github.com/mattermost/mattermost/tree/master/server/channels/jobs) packages:

```go
func TestExample(t *testing.T) {
  mainHelper.Parallel(t)

  ...
}

// OR

func TestExample(t *testing.T) {
  th := Setup(t)
  th.Parallel(t)

  ...
}

// OR

func TestExample(t *testing.T) {
  if mainHelper.Options.RunParallel {
    t.Parallel()
  }

  ...
}

```

If [`sqlstore`](https://github.com/mattermost/mattermost/tree/master/server/channels/store/sqlstore) package:

```go
func TestExample(t *testing.T) {
  if enableFullyParallelTests {
    t.Parallel()
  }

  ...
}
```

To enable parallel execution, you should set the `ENABLE_FULLY_PARALLEL_TESTS` environment variable. Example:

```bash
ENABLE_FULLY_PARALLEL_TESTS=true go test -v ./api4/...
```

### When to Use Parallel Tests

- **Generally Safe**: Tests with dedicated setup functions that ensure independence from other tests.
- **Subtests**: Only safe if each subtest features its own setup function, ensuring they are decoupled and independent of execution order.
- **Unsafe**: When a subtest depends on state changes made by another subtest, thus coupling their execution order.

### Common Issues That Break Parallel Safety

#### Global State

Avoid reliance on global variables and registrations such as:

- `LicenseValidator`
- `platform.RegisterMetricsInterface`
- `platform.PurgeLinkCache`
- `model.BuildEnterpriseReady`
- `jobs.DefaultWatcherPollingInterval`

#### Filesystem Operations

Avoid using `os.Chdir` (or `t.Chdir`) and relative paths tied to the test executable, as they may introduce inconsistencies when tests run in parallel. When possible, rely on temporary directories such as `th.tempWorkspace` which are dedicated to the test.

#### Environment Variables

Using `os.Setenv` for feature flags and other settings can cause interference between parallel tests. Instead, use the configuration API:

```go
// UNSAFE for parallel tests:
os.Setenv("MM_FEATUREFLAGS_CUSTOMFEATURE", "true")
defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMFEATURE")

// SAFE for parallel tests:
th.App.UpdateConfig(func(cfg *model.Config) {
    cfg.FeatureFlags.CustomFeature = true
})
```

#### Process-Level Methods

Be cautious with methods affecting the entire process, such as `pprof.StartCPUProfile`, which can introduce contention between tests.
