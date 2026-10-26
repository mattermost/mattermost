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
//   - MM_LICENSE: A license with the Cluster feature, required by SetupCluster (see Clusters).
//
// # Container lifecycle
//
// Containers (Postgres + Mattermost) are started once per `go test` invocation and node
// count, so a test binary that calls both Setup and SetupCluster runs a single server and
// a cluster side by side, each with its own Postgres, until it exits.
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
//
// # Clusters
//
// SetupCluster(t, n) runs the test against a high-availability cluster of n nodes
// instead, for plugins whose behaviour spans nodes (cluster events, per-node state):
//
//	func TestAcrossNodes(t *testing.T) {
//	    th := testhelper.SetupCluster(t, 2)
//	    a, b := th.Nodes[0], th.Nodes[1]
//	    // Call the plugin through a.AdminClient and b.AdminClient; send cluster
//	    // events to b.ID; b.Pause(t) or b.Stop(t) to take a node away.
//	}
//
// The nodes share one Postgres database, which also holds the configuration
// (MM_CONFIG), and one file store volume, so the plugin is deployed once and runs
// on every node. Each Setup resets the database through the first node with the
// other nodes stopped, then waits until all nodes have joined the cluster again.
//
// Clustering requires a license with the Cluster feature (Mattermost Entry does not
// include it). SetupCluster reads it from MM_LICENSE and starts the nodes with
// MM_SERVICEENVIRONMENT=test, so a license signed with Mattermost's test key works.
// In GitHub Actions, map a secret to it, e.g.
// MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}. Without MM_LICENSE,
// cluster tests are skipped; with a license the server rejects, or one without the
// Cluster feature, they fail.
package testhelper
