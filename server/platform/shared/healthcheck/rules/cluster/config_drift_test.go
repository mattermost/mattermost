// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	driftMessage           = "health.rule.cluster_config_drift.message"
	driftNodeMessage       = "health.rule.cluster_config_drift.message.node"
	driftNoMajorityMessage = "health.rule.cluster_config_drift.message.no_majority"
	driftMixedBuilds       = "health.rule.cluster_config_drift.message.mixed_builds"
)

var driftMixed = want{state: healthcheck.StateUnknown, messageID: driftMixedBuilds}

func driftNoMajority(groups string) want {
	return want{state: healthcheck.StateUnknown, messageID: driftNoMajorityMessage, details: map[string]string{"groups": groups}}
}

// hashNodes builds live nodes on one build that advertise hashes. An empty hash is a node
// known only to the database or one that has not advertised yet.
func hashNodes(hashes ...string) []*healthcheck.NodeSnapshot {
	nodes := liveNodes(make([]string, len(hashes))...)
	for i, node := range nodes {
		if hashes[i] != "" {
			node.ClusterInfo.Version = "11.1.0.100"
			node.ClusterInfo.ConfigHash = hashes[i]
		}
	}
	return nodes
}

func withBuild(nodes []*healthcheck.NodeSnapshot, i int, build string) []*healthcheck.NodeSnapshot {
	nodes[i].ClusterInfo.Version = build
	return nodes
}

func TestConfigDrift(t *testing.T) {
	t.Parallel()

	unlicensed := hashNodes("aaa", "bbb", "aaa")
	unlicensed[0].Diagnostics.Diagnostics.License = model.SupportPacketLicense{}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		global   want
		nodes    []want
	}{
		{
			name:     "all hashes equal",
			snapshot: configSnapshot(clusterOn, hashNodes("aaa", "aaa", "aaa")...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "one node differs",
			snapshot: configSnapshot(clusterOn, hashNodes("aaa", "bbb", "aaa")...),
			global:   firing(driftMessage, map[string]string{"nodes": "app-2.example.com"}),
			nodes: []want{
				resolved,
				firing(driftNodeMessage, map[string]string{"node": "app-2.example.com", "majority": "2"}),
				resolved,
			},
		},
		{
			name:     "two minority hashes are both listed",
			snapshot: configSnapshot(clusterOn, hashNodes("ccc", "aaa", "aaa", "bbb", "aaa")...),
			global:   firing(driftMessage, map[string]string{"nodes": "app-1.example.com, app-4.example.com"}),
			nodes: []want{
				firing(driftNodeMessage, map[string]string{"node": "app-1.example.com", "majority": "3"}),
				resolved,
				resolved,
				firing(driftNodeMessage, map[string]string{"node": "app-4.example.com", "majority": "3"}),
				resolved,
			},
		},
		{
			name:     "a tie for the most common hash",
			snapshot: configSnapshot(clusterOn, hashNodes("aaa", "bbb", "bbb", "aaa")...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com"}),
			nodes: []want{
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com"),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com"),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com"),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com"),
			},
		},
		{
			name:     "two nodes with two hashes",
			snapshot: configSnapshot(clusterOn, hashNodes("bbb", "aaa")...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com | app-2.example.com"}),
			nodes:    []want{driftNoMajority("app-1.example.com | app-2.example.com"), driftNoMajority("app-1.example.com | app-2.example.com")},
		},
		{
			name:     "a node without a hash is left out of the vote",
			snapshot: configSnapshot(clusterOn, hashNodes("aaa", "aaa", "")...),
			global:   resolved,
			nodes:    []want{resolved, resolved, diagUnknown},
		},
		{
			name:     "a node without a hash does not break a tie",
			snapshot: configSnapshot(clusterOn, hashNodes("aaa", "bbb", "")...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com | app-2.example.com"}),
			nodes:    []want{driftNoMajority("app-1.example.com | app-2.example.com"), driftNoMajority("app-1.example.com | app-2.example.com"), diagUnknown},
		},
		{
			name:     "a build mismatch",
			snapshot: configSnapshot(clusterOn, withBuild(hashNodes("aaa", "bbb", "aaa"), 1, "11.0.4.90")...),
			global:   driftMixed,
			nodes:    []want{driftMixed, driftMixed, driftMixed},
		},
		{
			name:     "a hotfix rebuild of the same release",
			snapshot: configSnapshot(clusterOn, withBuild(hashNodes("aaa", "aaa", "bbb"), 2, "11.1.0.101")...),
			global:   driftMixed,
			nodes:    []want{driftMixed, driftMixed, driftMixed},
		},
		{
			name:     "a packet snapshot",
			snapshot: configSnapshot(clusterOn, packetNodes("11.1.0", "11.1.0", "11.1.0")...),
			global:   diagUnknown,
			nodes:    []want{diagUnknown, diagUnknown, diagUnknown},
		},
		{
			name:     "without the cluster feature",
			snapshot: configSnapshot(clusterOn, unlicensed...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "cluster disabled",
			snapshot: configSnapshot(nil, hashNodes("aaa", "bbb", "aaa")...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "config absent",
			snapshot: healthcheck.NewSnapshot(hashNodes("aaa", "bbb")),
			global:   configUnknown,
			nodes:    []want{configUnknown, configUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			assertResult(t, tc.global, configDrift.Eval(tc.snapshot), "global")

			nodes := tc.snapshot.Nodes()
			require.Len(t, nodes, len(tc.nodes))
			for i, node := range nodes {
				assertResult(t, tc.nodes[i], configDrift.EvalNode(tc.snapshot, node), node.Hostname)
			}
		})
	}
}

func TestConfigDriftFingerprints(t *testing.T) {
	t.Parallel()

	registry := healthcheck.NewRegistry()
	registry.Register(configDrift)
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry})
	evaluations := engine.Evaluate(configSnapshot(clusterOn, hashNodes("aaa", "bbb", "aaa")...))
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
