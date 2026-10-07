// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	skewMessage           = "health.rule.cluster_version_skew.message"
	skewNodeMessage       = "health.rule.cluster_version_skew.message.node"
	skewNoMajorityMessage = "health.rule.cluster_version_skew.message.no_majority"
)

func clusterOn(cfg *model.Config) { cfg.ClusterSettings.Enable = new(true) }

// liveNodes builds nodes the way the live snapshot does: every node from gossip, the first
// one also the leader with diagnostics. An empty version is a node known only to the database.
func liveNodes(versions ...string) []*healthcheck.NodeSnapshot {
	nodes := make([]*healthcheck.NodeSnapshot, 0, len(versions))
	for i, version := range versions {
		hostname := fmt.Sprintf("app-%d.example.com", i+1)
		node := &healthcheck.NodeSnapshot{Hostname: hostname}
		if i == 0 {
			node = leaderNode(nil)
		}
		node.ClusterInfo = &model.ClusterInfo{Id: hostname, Hostname: hostname, Version: version}
		nodes = append(nodes, node)
	}
	return nodes
}

// packetNodes builds nodes the way the packet reader does: diagnostics only, the first one leading.
func packetNodes(versions ...string) []*healthcheck.NodeSnapshot {
	nodes := make([]*healthcheck.NodeSnapshot, 0, len(versions))
	for i, version := range versions {
		hostname := fmt.Sprintf("app-%d.example.com", i+1)
		nodes = append(nodes, diagNode(hostname, i == 0, func(diag *model.SupportPacketDiagnostics) {
			diag.Server.Version = version
		}))
	}
	return nodes
}

func evaluateSkew(s *healthcheck.Snapshot) []healthcheck.Evaluation {
	registry := healthcheck.NewRegistry()
	registry.Register(versionSkew)
	evaluatedAt := time.Date(2026, time.October, 7, 10, 0, 0, 0, time.UTC)
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry, Now: func() time.Time { return evaluatedAt }})
	return engine.Evaluate(s)
}

func TestVersionSkew(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		global   want
		nodes    []want
	}{
		{
			name:     "one node behind",
			snapshot: configSnapshot(clusterOn, liveNodes("10.5.0.1", "10.4.0.1", "10.5.0.1")...),
			global:   firing(skewMessage, map[string]string{"versions": "10.4.0.1, 10.5.0.1"}),
			nodes: []want{
				resolved,
				firing(skewNodeMessage, map[string]string{"version": "10.4.0.1", "majority": "10.5.0.1"}),
				resolved,
			},
		},
		{
			name:     "all equal",
			snapshot: configSnapshot(clusterOn, liveNodes("10.5.0.1", "10.5.0.1", "10.5.0.1")...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "no node reports a version",
			snapshot: configSnapshot(clusterOn, packetNodes("", "", "")...),
			global:   diagUnknown,
			nodes:    []want{diagUnknown, diagUnknown, diagUnknown},
		},
		{
			name:     "two nodes on two versions have no majority",
			snapshot: configSnapshot(clusterOn, liveNodes("10.5.0.1", "10.4.0.1")...),
			global:   firing(skewMessage, map[string]string{"versions": "10.4.0.1, 10.5.0.1"}),
			nodes: []want{
				{state: healthcheck.StateUnknown, messageID: skewNoMajorityMessage},
				{state: healthcheck.StateUnknown, messageID: skewNoMajorityMessage},
			},
		},
		{
			name:     "a node known only to the database",
			snapshot: configSnapshot(clusterOn, liveNodes("10.5.0.1", "10.5.0.1", "")...),
			global:   resolved,
			nodes:    []want{resolved, resolved, diagUnknown},
		},
		{
			name:     "cluster disabled",
			snapshot: configSnapshot(nil, liveNodes("10.5.0.1", "10.4.0.1", "")...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "config absent",
			snapshot: healthcheck.NewSnapshot(liveNodes("10.5.0.1", "10.4.0.1")),
			global:   configUnknown,
			nodes:    []want{configUnknown, configUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			assertResult(t, tc.global, versionSkew.Eval(tc.snapshot), "global")

			nodes := tc.snapshot.Nodes()
			require.Len(t, nodes, len(tc.nodes))
			for i, node := range nodes {
				assertResult(t, tc.nodes[i], versionSkew.EvalNode(tc.snapshot, node), node.Hostname)
			}
		})
	}
}

func TestVersionSkewFingerprints(t *testing.T) {
	t.Parallel()

	evaluations := evaluateSkew(configSnapshot(clusterOn, liveNodes("10.5.0.1", "10.4.0.1", "10.5.0.1")...))
	require.Len(t, evaluations, 4)

	states := map[string]healthcheck.State{}
	fingerprints := map[string]bool{}
	for _, evaluation := range evaluations {
		states[evaluation.Result.Scope] = evaluation.Result.State
		fingerprints[evaluation.Fingerprint] = true
	}

	assert.Equal(t, map[string]healthcheck.State{
		"":                  healthcheck.StateFiring,
		"app-1.example.com": healthcheck.StateResolved,
		"app-2.example.com": healthcheck.StateFiring,
		"app-3.example.com": healthcheck.StateResolved,
	}, states)
	assert.Len(t, fingerprints, 4)
}

func TestVersionSkewLiveOfflineParity(t *testing.T) {
	t.Parallel()

	for _, versions := range [][]string{
		{"11.1.0", "11.1.0", "11.1.0"},
		{"11.1.0", "11.0.4", "11.1.0"},
	} {
		live := evaluateSkew(configSnapshot(haEnabled, liveNodes(versions...)...))
		offline := evaluateSkew(configSnapshot(haEnabled, packetNodes(versions...)...))
		assert.Equal(t, live, offline, versions)
	}

	t.Run("a build-number-only skew is visible live only", func(t *testing.T) {
		t.Parallel()

		live := configSnapshot(haEnabled, liveNodes("11.1.0.100", "11.1.0.101", "11.1.0.100")...)
		offline := configSnapshot(haEnabled, packetNodes("11.1.0", "11.1.0", "11.1.0")...)

		assert.Equal(t, healthcheck.StateFiring, versionSkew.Eval(live)[0].State)
		assert.Equal(t, healthcheck.StateResolved, versionSkew.Eval(offline)[0].State)
	})
}

// clusterTableWarns mirrors the System Console cluster table, which warns when any node's
// version differs from the first node's.
func clusterTableWarns(infos []*model.ClusterInfo) bool {
	for _, info := range infos {
		if info.Version != infos[0].Version {
			return true
		}
	}
	return false
}

func TestVersionSkewAgreesWithClusterTable(t *testing.T) {
	t.Parallel()

	for _, versions := range [][]string{
		{"11.1.0.100", "11.1.0.100", "11.1.0.100"},
		{"11.1.0.100", "11.0.4.90", "11.1.0.100"},
		{"11.0.4.90", "11.1.0.100", "11.1.0.100"},
		{"11.1.0.100", "11.0.4.90"},
		{"11.1.0.100", "11.1.0.101", "11.1.0.100"},
	} {
		nodes := liveNodes(versions...)
		infos := make([]*model.ClusterInfo, 0, len(nodes))
		for _, node := range nodes {
			infos = append(infos, node.ClusterInfo)
		}

		skewed := versionSkew.Eval(configSnapshot(haEnabled, nodes...))[0].State == healthcheck.StateFiring
		assert.Equal(t, clusterTableWarns(infos), skewed, versions)
	}

	t.Run("a node known only to the database is unknown rather than skewed", func(t *testing.T) {
		t.Parallel()

		nodes := liveNodes("11.1.0.100", "11.1.0.100", "")
		s := configSnapshot(haEnabled, nodes...)

		assert.True(t, clusterTableWarns([]*model.ClusterInfo{nodes[0].ClusterInfo, nodes[1].ClusterInfo, nodes[2].ClusterInfo}))
		assert.Equal(t, healthcheck.StateResolved, versionSkew.Eval(s)[0].State)
		assert.Equal(t, healthcheck.StateUnknown, versionSkew.EvalNode(s, nodes[2])[0].State)
	})
}
