// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

// Package testhelper provides integration test infrastructure for Mattermost plugins.
//
// It uses testcontainers-go to spin up a real Mattermost server backed by Postgres
// during `go test`. The plugin under test is built via `make dist` (which runs as a
// Makefile prerequisite before tests) and deployed into the running server automatically.
//
// # Usage
//
//	func TestMyFeature(t *testing.T) {
//	    th := testhelper.Setup(t)
//	    // th.AdminClient, th.Client, th.Team, th.Channel are ready to use.
//	}
//
// # Requirements
//
//   - Docker must be running (tests fail if Docker is unavailable; set SKIP_DOCKER_TESTS to skip)
//   - The plugin bundle must exist at dist/*.tar.gz (handled by `make test` which depends on `make dist`)
//
// # Environment variables
//
//   - MM_TEST_IMAGE: Override the Mattermost Docker image (default: mattermost/mattermost-enterprise-edition:latest).
//     Examples: "mattermost/mattermost-enterprise-edition:10.5" for a specific release,
//     "mattermostdevelopment/mattermost-enterprise-edition:master" for bleeding-edge.
//   - SKIP_DOCKER_TESTS: Set to any value to skip integration tests.
//
// # Container lifecycle
//
// Containers (Postgres + Mattermost) are started once per `go test` invocation via sync.Once.
// Cleanup is handled by the testcontainers-go Ryuk reaper sidecar, which automatically removes
// containers when the parent process exits — even on crashes. Do not disable Ryuk
// (TESTCONTAINERS_RYUK_DISABLED must remain false) to prevent container leaks in CI.
//
// # Test isolation
//
// Each call to Setup() resets the database (truncates all data tables, preserving only
// migrations), restarts the Mattermost container so default roles and permissions are
// re-initialized, re-creates the admin user, re-deploys the plugin, and creates a fresh
// team, user, and channel. This guarantees complete isolation between tests — no KVStore
// entries, posts, users, or any other state leaks from one test to the next. The reset
// adds approximately 10 seconds of overhead per test.
package testhelper
