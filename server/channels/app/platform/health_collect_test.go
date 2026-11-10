// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
)

// healthCollectCluster is this node, "local", in a cluster of infos. collect answers
// CollectHealthDiagnostics for the other nodes.
type healthCollectCluster struct {
	*testlib.FakeClusterInterface
	infos   []*model.ClusterInfo
	collect func(rctx request.CTX) map[string]*model.NodeDiagnostics
}

func (c *healthCollectCluster) GetClusterId() string { return "local" }

func (c *healthCollectCluster) GetClusterInfos() ([]*model.ClusterInfo, error) {
	return c.infos, nil
}

func (c *healthCollectCluster) CollectHealthDiagnostics(rctx request.CTX) map[string]*model.NodeDiagnostics {
	if c.collect == nil {
		return nil
	}
	return c.collect(rctx)
}

func setupHealthCollect(t *testing.T, infos []*model.ClusterInfo) (*TestHelper, *healthCollectCluster) {
	t.Helper()

	cluster := &healthCollectCluster{FakeClusterInterface: &testlib.FakeClusterInterface{}, infos: infos}
	th := SetupWithCluster(t, cluster)
	return th, cluster
}

func connectedInfos(ids ...string) []*model.ClusterInfo {
	infos := []*model.ClusterInfo{{Id: "local", Hostname: "local-host", IPAddress: "10.0.0.1"}}
	for _, id := range ids {
		infos = append(infos, &model.ClusterInfo{Id: id, Hostname: id + "-host", IPAddress: "10.0.0.2"})
	}
	return infos
}

// nodeDiagnostics returns a node's diagnostics reporting hostname, with errs as section errors.
func nodeDiagnostics(hostname string, errs model.SectionErrors) *model.NodeDiagnostics {
	var diag model.SupportPacketDiagnostics
	diag.Server.Hostname = model.NewPointer(hostname)
	return &model.NodeDiagnostics{Diagnostics: &diag, Errors: errs}
}

func nodesByID(nodes []*healthcheck.NodeSnapshot) map[string]*healthcheck.NodeSnapshot {
	byID := map[string]*healthcheck.NodeSnapshot{}
	for _, node := range nodes {
		byID[node.ClusterInfo.Id] = node
	}
	return byID
}

func TestCollectHealthNodes(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("every node replies", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2", "node-3"))
		cluster.collect = func(request.CTX) map[string]*model.NodeDiagnostics {
			return map[string]*model.NodeDiagnostics{
				"node-2": nodeDiagnostics("node-2-host", model.SectionErrors{model.SectionSMTPProbe: nil}),
				"node-3": nodeDiagnostics("node-3-host", model.SectionErrors{model.SectionSMTPProbe: errors.New("dial tcp: timeout")}),
			}
		}

		nodes, err := th.Service.CollectHealthNodes(th.Context)
		require.NoError(t, err)

		require.Len(t, nodes, 3)
		byID := nodesByID(nodes)
		for id, node := range byID {
			require.NotNil(t, node.Diagnostics, id)
			assert.NoError(t, node.CollectErr, id)
		}
		assert.Equal(t, "node-2-host", *byID["node-2"].Diagnostics.Diagnostics.Server.Hostname)
		assert.True(t, byID["node-2"].Has(model.SectionSMTPProbe))
		_, smtpErr := byID["node-3"].SectionErr(model.SectionSMTPProbe)
		assert.EqualError(t, smtpErr, "dial tcp: timeout")
	})

	t.Run("a node that does not reply is marked", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2", "node-3"))
		cluster.collect = func(request.CTX) map[string]*model.NodeDiagnostics {
			return map[string]*model.NodeDiagnostics{"node-2": nodeDiagnostics("node-2-host", nil)}
		}

		nodes, err := th.Service.CollectHealthNodes(th.Context)
		require.NoError(t, err)

		byID := nodesByID(nodes)
		assert.NotNil(t, byID["local"].Diagnostics)
		assert.NotNil(t, byID["node-2"].Diagnostics)
		assert.Nil(t, byID["node-3"].Diagnostics)
		assert.ErrorIs(t, byID["node-3"].CollectErr, healthcheck.ErrNodeNoReply)
	})

	t.Run("nodes that replied by the caller's deadline are used", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2", "node-3"))
		ctx, cancel := context.WithTimeout(th.Context.Context(), 200*time.Millisecond)
		defer cancel()
		cluster.collect = func(rctx request.CTX) map[string]*model.NodeDiagnostics {
			<-rctx.Context().Done()
			return map[string]*model.NodeDiagnostics{"node-2": nodeDiagnostics("node-2-host", nil)}
		}

		nodes, err := th.Service.CollectHealthNodes(th.Context.WithContext(ctx))
		require.NoError(t, err)

		byID := nodesByID(nodes)
		assert.NotNil(t, byID["node-2"].Diagnostics)
		assert.ErrorIs(t, byID["node-3"].CollectErr, healthcheck.ErrNodeNoReply)
	})

	t.Run("cancelling the context aborts the run", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2"))
		ctx, cancel := context.WithCancel(th.Context.Context())
		defer cancel()
		cluster.collect = func(request.CTX) map[string]*model.NodeDiagnostics {
			cancel()
			return nil
		}

		nodes, err := th.Service.CollectHealthNodes(th.Context.WithContext(ctx))
		require.ErrorIs(t, err, context.Canceled)
		assert.Nil(t, nodes)
	})

	t.Run("standalone collects locally only", func(t *testing.T) {
		th := Setup(t)
		require.Nil(t, th.Service.Cluster())

		nodes, err := th.Service.CollectHealthNodes(th.Context)
		require.NoError(t, err)
		require.Len(t, nodes, 1)
		assert.True(t, nodes[0].IsLeader)
		assert.Nil(t, nodes[0].ClusterInfo)
		require.NotNil(t, nodes[0].Diagnostics)
		for _, section := range model.AllNodeSections() {
			assert.True(t, nodes[0].Has(section), section)
		}
	})
}

// A real node's diagnostics survive the JSON that nodes send each other.
func TestNodeDiagnosticsJSONRoundTrip(t *testing.T) {
	mainHelper.Parallel(t)

	data, err := os.ReadFile(filepath.Join(server.GetPackagePath(), "platform", "shared", "healthcheck", "packet", "testdata", "ha", "app-2.example.com", "diagnostics.yaml"))
	require.NoError(t, err)
	var diag model.SupportPacketDiagnostics
	require.NoError(t, yaml.Unmarshal(data, &diag))
	require.True(t, diag.Cluster.IsLeader)

	diagnostics := &model.NodeDiagnostics{
		Diagnostics: &diag,
		Errors: model.SectionErrors{
			model.SectionServerHost: nil,
			model.SectionSMTPProbe:  errors.New("dial tcp 10.0.0.5:25: i/o timeout"),
		},
	}

	data, err = json.Marshal(diagnostics)
	require.NoError(t, err)

	var got model.NodeDiagnostics
	require.NoError(t, json.Unmarshal(data, &got))
	assert.Equal(t, diagnostics.Diagnostics, got.Diagnostics)
	require.Len(t, got.Errors, 2)
	require.Contains(t, got.Errors, model.SectionServerHost)
	assert.NoError(t, got.Errors[model.SectionServerHost])
	assert.EqualError(t, got.Errors[model.SectionSMTPProbe], "dial tcp 10.0.0.5:25: i/o timeout")
}

func TestHealthNodes(t *testing.T) {
	mainHelper.Parallel(t)

	diagnostics := func(hostname string, isLeader bool) *model.NodeDiagnostics {
		var diag model.SupportPacketDiagnostics
		diag.Server.Hostname = model.NewPointer(hostname)
		diag.Cluster.IsLeader = isLeader
		return &model.NodeDiagnostics{Diagnostics: &diag, Errors: model.SectionErrors{}}
	}
	current := model.CurrentVersion + ".12345"
	infos := []*model.ClusterInfo{
		{Id: "id-1", Hostname: "node-1", Version: current, IPAddress: "10.0.0.1"},
		{Id: "id-2", Hostname: "node-2", Version: current, IPAddress: "10.0.0.2"},
		{Id: "id-3", Hostname: "node-3", Version: current, IPAddress: "10.0.0.3"},
	}
	leaders := func(nodes []*healthcheck.NodeSnapshot) []string {
		var hostnames []string
		for _, node := range nodes {
			if node.IsLeader {
				hostnames = append(hostnames, node.Hostname)
			}
		}
		return hostnames
	}

	t.Run("standalone", func(t *testing.T) {
		nodes := healthNodes(nil, "", map[string]*model.NodeDiagnostics{"": diagnostics("host-a", false)})
		require.Len(t, nodes, 1)
		assert.True(t, nodes[0].IsLeader)
		assert.Nil(t, nodes[0].ClusterInfo)
		assert.Equal(t, "host-a", nodes[0].Hostname)
		assert.NotNil(t, nodes[0].Diagnostics)
		assert.NoError(t, nodes[0].CollectErr)
	})

	t.Run("the leader is the node whose diagnostics say so", func(t *testing.T) {
		nodes := healthNodes(infos, "id-1", map[string]*model.NodeDiagnostics{
			"id-1": diagnostics("node-1", false),
			"id-2": diagnostics("node-2", false),
			"id-3": diagnostics("node-3", true),
		})
		require.Len(t, nodes, 3)
		assert.Equal(t, []string{"node-3"}, leaders(nodes))
		for _, node := range nodes {
			assert.NotNil(t, node.Diagnostics, node.Hostname)
			assert.NoError(t, node.CollectErr, node.Hostname)
		}
	})

	t.Run("the local node stands in for a leader that did not reply", func(t *testing.T) {
		nodes := healthNodes(infos, "id-1", map[string]*model.NodeDiagnostics{
			"id-1": diagnostics("node-1", false),
			"id-2": diagnostics("node-2", false),
		})
		assert.Equal(t, []string{"node-1"}, leaders(nodes))
		assert.Nil(t, nodes[2].Diagnostics)
		assert.ErrorIs(t, nodes[2].CollectErr, healthcheck.ErrNodeNoReply)
	})
}

// A snapshot built from every node's reply evaluates like the Support Packet of the same
// cluster. The replies are the HA fixture's per-node diagnostics.
func TestHealthSnapshotRepliesMatchPacket(t *testing.T) {
	mainHelper.Parallel(t)

	dir := filepath.Join(server.GetPackagePath(), "platform", "shared", "healthcheck", "packet", "testdata", "ha")
	var zipped bytes.Buffer
	zw := zip.NewWriter(&zipped)
	require.NoError(t, zw.AddFS(os.DirFS(dir)))
	require.NoError(t, zw.Close())
	offline, err := packet.Read(bytes.NewReader(zipped.Bytes()), int64(zipped.Len()))
	require.NoError(t, err)

	var infos []*model.ClusterInfo
	collected := map[string]*model.NodeDiagnostics{}
	for _, node := range offline.Snapshot.Nodes() {
		diag, ok := node.Diag()
		require.True(t, ok)
		id := "id-" + node.Hostname
		collected[id] = node.Diagnostics
		infos = append(infos, &model.ClusterInfo{
			Id:            id,
			Hostname:      node.Hostname,
			Version:       diag.Server.Version + ".12345",
			SchemaVersion: model.SafeDereference(diag.Database.SchemaVersion),
			IPAddress:     "10.0.0.1",
		})
	}
	require.Len(t, infos, 3)

	// The first node evaluates; the fixture's leader is another node.
	nodes := healthNodes(infos, infos[0].Id, collected)
	live := healthcheck.NewSnapshot(nodes)
	live.CollectedAt = offline.Snapshot.CollectedAt
	live.Config = offline.Snapshot.Config
	live.Stats = offline.Snapshot.Stats
	live.Jobs = offline.Snapshot.Jobs
	live.Plugins = offline.Snapshot.Plugins
	live.Version = offline.Snapshot.Version
	live.Sections = offline.Snapshot.Sections

	liveLeader, ok := live.Leader()
	require.True(t, ok)
	offlineLeader, ok := offline.Snapshot.Leader()
	require.True(t, ok)
	assert.Equal(t, offlineLeader.Hostname, liveLeader.Hostname)
	assert.NotEqual(t, infos[0].Hostname, liveLeader.Hostname)

	engine := healthcheck.NewEngine(healthcheck.EngineOpts{
		Registry: healthcheck.Builtin(),
		Now:      func() time.Time { return offline.Snapshot.CollectedAt },
	})
	liveEvaluations := engine.Evaluate(live)
	require.NotEmpty(t, liveEvaluations)
	assert.Equal(t, engine.Evaluate(offline.Snapshot), liveEvaluations)

	// Followers are evaluated, not unknown.
	fdScopes := map[string]healthcheck.State{}
	for _, evaluation := range liveEvaluations {
		if evaluation.Code == "NODE_FD_EXHAUSTION" {
			fdScopes[evaluation.Result.Scope] = evaluation.Result.State
		}
	}
	require.Len(t, fdScopes, 3)
	for scope, state := range fdScopes {
		assert.NotEqual(t, healthcheck.StateUnknown, state, scope)
	}
}
