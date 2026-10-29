// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
)

// healthCollectCluster is this node, "local", in a cluster of infos. onRequest is called for
// every collect request this node broadcasts; replies are delivered with deliver.
type healthCollectCluster struct {
	*testlib.FakeClusterInterface
	ps        *PlatformService
	infos     []*model.ClusterInfo
	onRequest func(req model.HealthCollectRequest)

	mut     sync.Mutex
	toNodes map[string][]*model.ClusterMessage
}

func (c *healthCollectCluster) GetClusterId() string { return "local" }

func (c *healthCollectCluster) GetClusterInfos() ([]*model.ClusterInfo, error) {
	return c.infos, nil
}

func (c *healthCollectCluster) SendClusterMessage(msg *model.ClusterMessage) {
	c.FakeClusterInterface.SendClusterMessage(msg)
	if msg.Event != model.ClusterEventHealthCollect || c.onRequest == nil {
		return
	}

	var req model.HealthCollectRequest
	if err := json.Unmarshal(msg.Data, &req); err == nil {
		go c.onRequest(req)
	}
}

func (c *healthCollectCluster) SendClusterMessageToNode(nodeID string, msg *model.ClusterMessage) error {
	c.mut.Lock()
	defer c.mut.Unlock()
	if c.toNodes == nil {
		c.toNodes = map[string][]*model.ClusterMessage{}
	}
	c.toNodes[nodeID] = append(c.toNodes[nodeID], msg)
	return nil
}

func (c *healthCollectCluster) sentTo(nodeID string) []*model.ClusterMessage {
	c.mut.Lock()
	defer c.mut.Unlock()
	return c.toNodes[nodeID]
}

func (c *healthCollectCluster) broadcasts() []*model.ClusterMessage {
	return c.SelectMessages(func(msg *model.ClusterMessage) bool {
		return msg.Event == model.ClusterEventHealthCollect
	})
}

// deliver hands a reply to this node as if it had arrived over the cluster.
func (c *healthCollectCluster) deliver(t *testing.T, runID, nodeID, hostname string, errs model.SectionErrors) {
	t.Helper()

	var diag model.SupportPacketDiagnostics
	diag.Server.Hostname = model.NewPointer(hostname)
	data, err := encodeHealthCollectReply(runID, nodeID, &model.NodeDiagnostics{Diagnostics: &diag, Errors: errs})
	require.NoError(t, err)
	c.ps.handleHealthCollectReply(&model.ClusterMessage{Event: model.ClusterEventHealthCollectReply, Data: data})
}

func setupHealthCollect(t *testing.T, infos []*model.ClusterInfo) (*TestHelper, *healthCollectCluster) {
	t.Helper()

	cluster := &healthCollectCluster{FakeClusterInterface: &testlib.FakeClusterInterface{}, infos: infos}
	th := SetupWithCluster(t, cluster)
	cluster.ps = th.Service
	return th, cluster
}

func connectedInfos(ids ...string) []*model.ClusterInfo {
	infos := []*model.ClusterInfo{{Id: "local", Hostname: "local-host", IPAddress: "10.0.0.1"}}
	for _, id := range ids {
		infos = append(infos, &model.ClusterInfo{Id: id, Hostname: id + "-host", IPAddress: "10.0.0.2"})
	}
	return infos
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
		cluster.onRequest = func(req model.HealthCollectRequest) {
			assert.Equal(t, "local", req.RequesterID)
			cluster.deliver(t, req.RunID, "node-2", "node-2-host", model.SectionErrors{model.SectionSMTPProbe: nil})
			cluster.deliver(t, req.RunID, "node-3", "node-3-host", model.SectionErrors{model.SectionSMTPProbe: errors.New("dial tcp: timeout")})
		}

		start := time.Now()
		nodes, err := th.Service.CollectHealthNodes(th.Context, time.Minute)
		require.NoError(t, err)
		assert.Less(t, time.Since(start), 30*time.Second)

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
		assert.Len(t, cluster.broadcasts(), 1)
	})

	t.Run("a node that never replies is left out at the deadline", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2", "node-3"))
		cluster.onRequest = func(req model.HealthCollectRequest) {
			cluster.deliver(t, req.RunID, "node-2", "node-2-host", nil)
		}

		start := time.Now()
		nodes, err := th.Service.CollectHealthNodes(th.Context, 500*time.Millisecond)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, time.Since(start), 500*time.Millisecond)

		byID := nodesByID(nodes)
		assert.NotNil(t, byID["local"].Diagnostics)
		assert.NotNil(t, byID["node-2"].Diagnostics)
		assert.Nil(t, byID["node-3"].Diagnostics)
		assert.ErrorIs(t, byID["node-3"].CollectErr, healthcheck.ErrNodeNoReply)
	})

	t.Run("replies for another run, from an unknown node or repeated are dropped", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2", "node-3"))
		cluster.onRequest = func(req model.HealthCollectRequest) {
			cluster.deliver(t, model.NewId(), "node-2", "wrong-run", nil)
			cluster.deliver(t, req.RunID, "node-9", "unknown-node", nil)
			cluster.deliver(t, req.RunID, "node-2", "node-2-host", nil)
			cluster.deliver(t, req.RunID, "node-2", "repeated", nil)
			cluster.deliver(t, req.RunID, "node-3", "node-3-host", nil)
		}

		nodes, err := th.Service.CollectHealthNodes(th.Context, time.Minute)
		require.NoError(t, err)
		byID := nodesByID(nodes)
		require.Len(t, byID, 3)
		assert.Equal(t, "node-2-host", *byID["node-2"].Diagnostics.Diagnostics.Server.Hostname)
		assert.Equal(t, "node-3-host", *byID["node-3"].Diagnostics.Diagnostics.Server.Hostname)
	})

	t.Run("a reply after the run ended is dropped", func(t *testing.T) {
		th, cluster := setupHealthCollect(t, connectedInfos("node-2"))
		runIDs := make(chan string, 1)
		cluster.onRequest = func(req model.HealthCollectRequest) { runIDs <- req.RunID }

		nodes, err := th.Service.CollectHealthNodes(th.Context, 100*time.Millisecond)
		require.NoError(t, err)
		assert.ErrorIs(t, nodesByID(nodes)["node-2"].CollectErr, healthcheck.ErrNodeNoReply)

		runID := <-runIDs
		assert.NotPanics(t, func() { cluster.deliver(t, runID, "node-2", "node-2-host", nil) })
		th.Service.healthCollectMut.Lock()
		assert.Empty(t, th.Service.healthCollectRuns)
		th.Service.healthCollectMut.Unlock()
	})

	t.Run("nodes that are not connected are not waited for", func(t *testing.T) {
		infos := append(connectedInfos(), &model.ClusterInfo{Id: "node-2", Hostname: "node-2-host"})
		th, cluster := setupHealthCollect(t, infos)

		start := time.Now()
		nodes, err := th.Service.CollectHealthNodes(th.Context, time.Minute)
		require.NoError(t, err)
		assert.Less(t, time.Since(start), 30*time.Second)
		assert.ErrorIs(t, nodesByID(nodes)["node-2"].CollectErr, healthcheck.ErrNodeNoReply)
		assert.Empty(t, cluster.broadcasts())
	})

	t.Run("standalone collects locally only", func(t *testing.T) {
		th := Setup(t)
		require.Nil(t, th.Service.Cluster())

		nodes, err := th.Service.CollectHealthNodes(th.Context, time.Minute)
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

func TestHandleHealthCollect(t *testing.T) {
	mainHelper.Parallel(t)

	th, cluster := setupHealthCollect(t, connectedInfos("requester"))
	data, err := json.Marshal(model.HealthCollectRequest{RunID: "run-1", RequesterID: "requester"})
	require.NoError(t, err)

	th.Service.handleHealthCollect(&model.ClusterMessage{Event: model.ClusterEventHealthCollect, Data: data})

	// Shutdown waits for the collection, so the reply is sent by the time the wait returns.
	th.Service.waitForGoroutines()
	require.Len(t, cluster.sentTo("requester"), 1)
	msg := cluster.sentTo("requester")[0]
	assert.Equal(t, model.ClusterEventHealthCollectReply, msg.Event)
	assert.Equal(t, model.ClusterSendReliable, msg.SendType)

	var reply model.HealthCollectReply
	require.NoError(t, json.Unmarshal(msg.Data, &reply))
	assert.Equal(t, "run-1", reply.RunID)
	assert.Equal(t, "local", reply.NodeID)

	diagnostics, err := decodeHealthCollectReply(&reply)
	require.NoError(t, err)
	assert.Equal(t, model.CurrentVersion, diagnostics.Diagnostics.Server.Version)
	assert.Len(t, diagnostics.Errors, len(model.AllNodeSections()))
}

func TestHealthCollectReplyRoundTrip(t *testing.T) {
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

	data, err = encodeHealthCollectReply("run-1", "node-1", diagnostics)
	require.NoError(t, err)

	var decoded model.HealthCollectReply
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, "run-1", decoded.RunID)
	assert.Equal(t, "node-1", decoded.NodeID)

	got, err := decodeHealthCollectReply(&decoded)
	require.NoError(t, err)
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

	t.Run("a node that did not reply reads as unknown when it runs an older version", func(t *testing.T) {
		mixed := []*model.ClusterInfo{
			{Id: "id-1", Hostname: "node-1", Version: current, IPAddress: "10.0.0.1"},
			{Id: "older", Hostname: "older", Version: "10.11.0.9999", IPAddress: "10.0.0.2"},
			{Id: "newer", Hostname: "newer", Version: "99.0.0.1", IPAddress: "10.0.0.3"},
			{Id: "same", Hostname: "same", Version: current, IPAddress: "10.0.0.4"},
			{Id: "db-only", Hostname: "db-only"},
		}
		nodes := healthNodes(mixed, "id-1", map[string]*model.NodeDiagnostics{"id-1": diagnostics("node-1", true)})
		require.Len(t, nodes, 5)
		assert.NoError(t, nodes[0].CollectErr)
		assert.ErrorIs(t, nodes[1].CollectErr, healthcheck.ErrNodeOlderVersion)
		for _, node := range nodes[2:] {
			assert.Nil(t, node.Diagnostics, node.Hostname)
			assert.ErrorIs(t, node.CollectErr, healthcheck.ErrNodeNoReply, node.Hostname)
		}
	})
}

func TestOlderVersion(t *testing.T) {
	mainHelper.Parallel(t)

	major, minor, patch := model.SplitVersion(model.CurrentVersion)
	for _, tc := range []struct {
		version string
		older   bool
	}{
		{"", false},
		{model.CurrentVersion + ".12345", false},
		{fmt.Sprintf("%d.%d.%d.1", major, minor, patch+1), false},
		{fmt.Sprintf("%d.%d.%d.1", major+1, 0, 0), false},
		{fmt.Sprintf("%d.%d.%d.1", major-1, minor+5, patch+5), true},
		{fmt.Sprintf("%d.%d.%d", major, minor-1, patch+5), true},
	} {
		assert.Equal(t, tc.older, olderVersion(&model.ClusterInfo{Version: tc.version}), tc.version)
	}
	assert.False(t, olderVersion(nil))
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
