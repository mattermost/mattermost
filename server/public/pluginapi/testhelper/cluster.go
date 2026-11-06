// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package testhelper

import (
	"context"
	"io"
	"net"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/moby/moby/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"

	"github.com/mattermost/mattermost/server/public/model"
)

// clusterFormTimeout bounds how long nodes may take to find each other.
const clusterFormTimeout = 2 * time.Minute

// Node is one Mattermost server of the test environment. Setup returns a single
// node; SetupCluster returns one per cluster member.
type Node struct {
	th *TestHelper
	nc *nodeContainer

	// ID is the node's cluster ID, usable as PluginClusterEventSendOptions.TargetId.
	// It is empty outside a cluster and while the node is stopped, and changes
	// whenever the node restarts.
	ID string

	// AdminClient is the admin's API client, aimed at this node. It shares the
	// session of TestHelper.AdminClient, which is Nodes[0].AdminClient.
	AdminClient *model.Client4

	// Client is the regular test user's API client, aimed at this node. It shares
	// the session of TestHelper.Client, which is Nodes[0].Client.
	Client *model.Client4
}

// SetupCluster is Setup for a high-availability cluster of n nodes. The nodes share
// one database, which also holds the configuration, and one file store, so a plugin
// uploaded through any node runs on every node. Each test starts from a freshly
// formed cluster with the plugin running on all nodes.
//
// Clustering needs a license with the Cluster feature: SetupCluster reads it from
// MM_LICENSE and starts the nodes in the test service environment, so a license
// signed with Mattermost's test key works. Without MM_LICENSE the test is skipped;
// with a license that doesn't enable clustering it fails.
func SetupCluster(t *testing.T, n int) *TestHelper {
	t.Helper()

	require.GreaterOrEqual(t, n, 2, "a cluster needs at least two nodes")
	if os.Getenv(licenseEnv) == "" {
		t.Skipf("Skipping cluster test: set %s to a license with the Cluster feature", licenseEnv)
	}
	return setup(t, n)
}

// Hostname is the container's hostname, e.g. "mm-node-1".
func (n *Node) Hostname() string { return n.nc.hostname }

// URL is the base URL of this node. It may change when the node restarts.
func (n *Node) URL() string { return n.nc.url }

// isCluster reports whether th runs a cluster rather than a single server.
func (th *TestHelper) isCluster() bool { return len(th.Nodes) > 1 }

// newNodes builds the Node list for th, with cluster IDs when in a cluster. The
// nodes' user clients are set once the test user exists.
func (th *TestHelper) newNodes(c *mmContainers) {
	th.t.Helper()

	th.Nodes = make([]*Node, len(c.nodes))
	for i, nc := range c.nodes {
		th.Nodes[i] = &Node{th: th, nc: nc, AdminClient: nodeClient(i, nc.url, th.AdminClient)}
	}
	if th.isCluster() {
		th.waitForCluster()
	}
}

// nodeClient returns the client for node i: c itself for the first node, whose
// clients are TestHelper's, otherwise a client for url that shares c's session.
func nodeClient(i int, url string, c *model.Client4) *model.Client4 {
	if i == 0 {
		return c
	}
	nc := model.NewAPIv4Client(url)
	nc.SetToken(c.AuthToken)
	return nc
}

// retarget points c at url, keeping its session.
func retarget(c *model.Client4, url string) {
	c.URL = strings.TrimRight(url, "/")
	c.APIURL = c.URL + model.APIURLSuffix
}

// requireClusterLicense fails the test unless the server runs with a license that
// enables clustering. The server only logs a license it can't use, so without this
// check a bad license shows up as a cluster that never forms.
func (th *TestHelper) requireClusterLicense() {
	th.t.Helper()

	license, _, err := th.AdminClient.GetOldClientLicense(th.t.Context(), "")
	require.NoError(th.t, err, "failed to read the server's license")
	require.Equal(th.t, "true", license["IsLicensed"],
		"the server did not accept %s; cluster tests need a license signed for the %q service environment",
		licenseEnv, model.ServiceEnvironmentTest)
	require.Equal(th.t, "true", license["Cluster"],
		"the license in %s does not include the Cluster feature", licenseEnv)
}

// forgetID clears the ID of a node that left the cluster. The old ID is kept as
// stale: Docker may hand the node's address to a restarted node while the old
// member is still listed under it.
func (n *Node) forgetID() {
	if n.ID != "" {
		n.th.staleIDs = append(n.th.staleIDs, n.ID)
		n.ID = ""
	}
}

// waitForCluster waits until every running node is a cluster member, and records
// each node's cluster ID. Members are matched to containers by their gossip
// address, which is the container's address on the Docker network; members with
// a stale ID are ignored.
func (th *TestHelper) waitForCluster() {
	th.t.Helper()

	var running []*Node
	for _, n := range th.Nodes {
		state, err := n.nc.container.State(th.t.Context())
		require.NoError(th.t, err, "failed to read state of %s", n.Hostname())
		switch {
		case !state.Running:
			n.forgetID()
		case state.Paused:
			// A paused node keeps its ID: it is still the same cluster member.
		default:
			running = append(running, n)
		}
	}

	require.NotEmpty(th.t, running, "no node is running")

	var ids map[string]string // container address -> cluster ID
	require.EventuallyWithT(th.t, func(c *assert.CollectT) {
		infos, _, err := running[0].AdminClient.GetClusterStatus(th.t.Context())
		require.NoError(c, err, "failed to read cluster status")
		ids = make(map[string]string, len(infos))
		for _, info := range infos {
			if slices.Contains(th.staleIDs, info.Id) {
				continue
			}
			// Registered nodes that aren't connected have no gossip address.
			host, _, err := net.SplitHostPort(info.IPAddress)
			if err == nil {
				ids[host] = info.Id
			}
		}
		for _, n := range running {
			assert.NotEmpty(c, ids[n.nc.ip], "%s has not joined the cluster; members: %v", n.Hostname(), ids)
		}
	}, clusterFormTimeout, 250*time.Millisecond, "cluster did not form: want %d connected nodes", len(running))

	for _, n := range running {
		n.ID = ids[n.nc.ip]
	}
}

// Exec runs cmd in the node's container and returns its combined output. It fails
// the test if the command can't run or exits non-zero.
func (n *Node) Exec(t *testing.T, cmd ...string) string {
	t.Helper()

	output, err := execInContainer(t.Context(), n.nc.container, cmd...)
	require.NoError(t, err, "command failed on %s", n.Hostname())
	return output
}

// Pause freezes every process of the node, so it stops answering both HTTP and its
// cluster peers without leaving the cluster: the way a hung or partitioned server
// looks to the rest of the cluster. The node is unpaused when the test ends.
func (n *Node) Pause(t *testing.T) {
	t.Helper()

	docker := dockerClient(t)
	_, err := docker.ContainerPause(t.Context(), n.nc.container.GetContainerID(), client.ContainerPauseOptions{})
	require.NoError(t, err, "failed to pause %s", n.Hostname())

	t.Cleanup(func() {
		// t.Context() is already canceled during cleanup.
		ctx := context.Background()
		if state, err := n.nc.container.State(ctx); err != nil || !state.Paused {
			return // unpaused or stopped by the test
		}
		if _, err := docker.ContainerUnpause(ctx, n.nc.container.GetContainerID(), client.ContainerUnpauseOptions{}); err != nil {
			t.Errorf("failed to unpause %s: %v", n.Hostname(), err)
		}
	})
}

// Unpause resumes a node frozen by Pause.
func (n *Node) Unpause(t *testing.T) {
	t.Helper()

	_, err := dockerClient(t).ContainerUnpause(t.Context(), n.nc.container.GetContainerID(), client.ContainerUnpauseOptions{})
	require.NoError(t, err, "failed to unpause %s", n.Hostname())
}

// Stop shuts the node down; in a cluster, it leaves the cluster.
func (n *Node) Stop(t *testing.T) {
	t.Helper()

	require.NoError(t, n.nc.stop(t.Context()))
	n.forgetID()
}

// Start starts a stopped node and, in a cluster, waits until it has rejoined. It
// updates the node's URL and clients, which may change with the restart, and its
// cluster ID, which always does.
func (n *Node) Start(t *testing.T) {
	t.Helper()

	// A node that stopped other than through Stop still holds its old ID.
	n.forgetID()
	require.NoError(t, n.nc.start(t.Context()))
	retarget(n.AdminClient, n.URL())
	retarget(n.Client, n.URL())
	if n == n.th.Nodes[0] {
		n.th.ServerURL = n.URL()
	}
	if n.th.isCluster() {
		n.th.waitForCluster()
	}
}

// dockerClient returns a Docker client that is closed when the test ends.
func dockerClient(t *testing.T) *testcontainers.DockerClient {
	t.Helper()

	docker, err := testcontainers.NewDockerClientWithOpts(t.Context())
	require.NoError(t, err, "failed to connect to Docker")
	t.Cleanup(func() { _ = docker.Close() })
	return docker
}

// dumpNodeLogs logs the tail of every node's container log. It is registered for
// failed tests, where the server's own errors are usually the explanation.
func dumpNodeLogs(t *testing.T, c *mmContainers) {
	const maxLines = 100

	for _, n := range c.nodes {
		logs, err := readLogs(n.container)
		if err != nil {
			t.Logf("failed to read logs of %s: %v", n.hostname, err)
			continue
		}
		lines := strings.Split(strings.TrimRight(logs, "\n"), "\n")
		if len(lines) > maxLines {
			lines = lines[len(lines)-maxLines:]
		}
		t.Logf("last %d log lines of %s:\n%s", len(lines), n.hostname, strings.Join(lines, "\n"))
	}
}

func readLogs(c testcontainers.Container) (string, error) {
	r, err := c.Logs(context.Background())
	if err != nil {
		return "", err
	}
	defer func() { _ = r.Close() }()
	logs, err := io.ReadAll(r)
	return string(logs), err
}
