// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

//go:build integration

package testhelper

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestSetupNode verifies that Setup() describes its single server as a node outside
// any cluster.
func TestSetupNode(t *testing.T) {
	th := Setup(t)

	require.Len(t, th.Nodes, 1)
	node := th.Nodes[0]
	assert.Empty(t, node.ID, "a single server has no cluster ID")
	assert.Equal(t, th.ServerURL, node.URL())
	assert.Same(t, th.AdminClient, node.AdminClient)
	assert.Same(t, th.Client, node.Client)
	assert.Equal(t, "mm-node-0", node.Hostname())
	// The image has no shell or coreutils, only the Mattermost binaries.
	assert.Contains(t, node.Exec(t, "mattermost", "version"), "Version:")
}

// TestSetupClusterSkipsWithoutLicense verifies that cluster tests skip, rather than
// fail, where no license is available, such as on pull requests from forks.
func TestSetupClusterSkipsWithoutLicense(t *testing.T) {
	var skipped bool
	t.Run("no license", func(t *testing.T) {
		t.Setenv(licenseEnv, "")
		defer func() { skipped = t.Skipped() }()
		SetupCluster(t, 2)
	})
	assert.True(t, skipped, "SetupCluster should skip without %s", licenseEnv)
}

// TestSetupClusterFormsCluster verifies that the nodes form one cluster, each with
// its own ID, and that the plugin runs on all of them.
func TestSetupClusterFormsCluster(t *testing.T) {
	th := SetupCluster(t, 2)
	ctx := t.Context()

	require.Len(t, th.Nodes, 2)
	ids := map[string]bool{}
	for _, node := range th.Nodes {
		require.NotEmpty(t, node.ID, "%s should have a cluster ID", node.Hostname())
		ids[node.ID] = true

		// Each node answers with the shared session.
		me, _, err := node.AdminClient.GetMe(ctx, "")
		require.NoError(t, err)
		assert.Equal(t, th.AdminUser.Id, me.Id)
	}
	assert.Len(t, ids, 2, "nodes should have distinct cluster IDs")

	statuses, _, err := th.AdminClient.GetPluginStatuses(ctx)
	require.NoError(t, err)
	running := map[string]bool{}
	for _, s := range statuses {
		if s.PluginId == PluginID() && s.State == model.PluginStateRunning {
			running[s.ClusterId] = true
		}
	}
	assert.Equal(t, ids, running, "plugin should run on every node")
}

// TestSetupClusterSharesConfig verifies that a configuration change made through one
// node reaches the other.
func TestSetupClusterSharesConfig(t *testing.T) {
	th := SetupCluster(t, 2)
	ctx := t.Context()

	siteName := "cluster-" + model.NewId()[:8]
	_, _, err := th.Nodes[0].AdminClient.PatchConfig(ctx, &model.Config{
		TeamSettings: model.TeamSettings{SiteName: model.NewPointer(siteName)},
	})
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		cfg, _, err := th.Nodes[1].AdminClient.GetConfig(ctx)
		return err == nil && *cfg.TeamSettings.SiteName == siteName
	}, 30*time.Second, 500*time.Millisecond, "config change should reach the other node")
}

// TestNodePause verifies that a paused node stops answering while the rest of the
// cluster keeps serving, and answers again once unpaused.
func TestNodePause(t *testing.T) {
	th := SetupCluster(t, 2)
	ctx := t.Context()
	paused := th.Nodes[1]

	// A paused server accepts connections but never answers, so bound the wait.
	probe := model.NewAPIv4Client(paused.URL())
	probe.HTTPClient = &http.Client{Timeout: 2 * time.Second}

	paused.Pause(t)
	_, _, err := probe.GetPing(ctx)
	assert.Error(t, err, "a paused node should not answer")
	_, _, err = th.Nodes[0].AdminClient.GetPing(ctx)
	assert.NoError(t, err, "the other node should keep serving")

	paused.Unpause(t)
	_, _, err = probe.GetPing(ctx)
	assert.NoError(t, err, "an unpaused node should answer again")
}

// TestNodeStopStart verifies that a stopped node rejoins the cluster on Start, with
// a new cluster ID and working clients.
func TestNodeStopStart(t *testing.T) {
	th := SetupCluster(t, 2)
	ctx := t.Context()
	node := th.Nodes[1]
	oldID, otherID := node.ID, th.Nodes[0].ID

	node.Stop(t)
	node.Start(t)

	require.NotEmpty(t, node.ID)
	assert.NotEqual(t, oldID, node.ID, "a restarted node joins with a new cluster ID")
	assert.Equal(t, otherID, th.Nodes[0].ID, "the node that kept running keeps its ID")
	me, _, err := node.AdminClient.GetMe(ctx, "")
	require.NoError(t, err)
	assert.Equal(t, th.AdminUser.Id, me.Id)
}
