// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"fmt"
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

// Configs as their section hashes: b differs from a in TeamSettings, c in SqlSettings and
// FileSettings, and d has a section the others lack.
var (
	cfgA = map[string]string{"FileSettings": "f1", "SqlSettings": "s1", "TeamSettings": "t1"}
	cfgB = map[string]string{"FileSettings": "f1", "SqlSettings": "s1", "TeamSettings": "t2"}
	cfgC = map[string]string{"FileSettings": "f2", "SqlSettings": "s2", "TeamSettings": "t1"}
	cfgD = map[string]string{"FileSettings": "f1", "SqlSettings": "s1", "TeamSettings": "t1", "NewSettings": "n1"}
)

func driftNoMajority(groups, sections string) want {
	return want{state: healthcheck.StateUnknown, messageID: driftNoMajorityMessage, details: map[string]string{"groups": groups, "sections": sections}}
}

func driftNode(node, majority, sections string) want {
	return firing(driftNodeMessage, map[string]string{"node": node, "majority": majority, "sections": sections})
}

// driftNodes builds nodes on one build whose diagnostics report the given section hashes, the
// first one leading. A nil config is a node without hashes: one that did not reply to a live
// health check, or one from a packet written before nodes reported them.
func driftNodes(configs ...map[string]string) []*healthcheck.NodeSnapshot {
	nodes := make([]*healthcheck.NodeSnapshot, 0, len(configs))
	for i, hashes := range configs {
		hostname := fmt.Sprintf("app-%d.example.com", i+1)
		nodes = append(nodes, diagNode(hostname, i == 0, func(diag *model.SupportPacketDiagnostics) {
			diag.Server.BuildHash = "abc123"
			diag.Config.SectionHashes = hashes
		}))
	}
	return nodes
}

// withBuild sets node i's build.
func withBuild(nodes []*healthcheck.NodeSnapshot, i int, version, buildHash string) []*healthcheck.NodeSnapshot {
	diag, _ := nodes[i].Diag()
	diag.Server.Version = version
	diag.Server.BuildHash = buildHash
	return nodes
}

// noReply turns node i into one a live health check knows only from gossip.
func noReply(nodes []*healthcheck.NodeSnapshot, i int) []*healthcheck.NodeSnapshot {
	nodes[i].ClusterInfo = &model.ClusterInfo{Id: nodes[i].Hostname, Hostname: nodes[i].Hostname, Version: "11.1.0.100"}
	nodes[i].Diagnostics = nil
	nodes[i].CollectErr = healthcheck.ErrNodeNoReply
	return nodes
}

func TestConfigDrift(t *testing.T) {
	t.Parallel()

	unlicensed := driftNodes(cfgA, cfgB, cfgA)
	unlicensed[0].Diagnostics.Diagnostics.License = model.SupportPacketLicense{}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		global   want
		nodes    []want
	}{
		{
			name:     "all configs equal",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgA, cfgA)...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "one node differs",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgB, cfgA)...),
			global:   firing(driftMessage, map[string]string{"nodes": "app-2.example.com", "sections": "TeamSettings"}),
			nodes:    []want{resolved, driftNode("app-2.example.com", "2", "TeamSettings"), resolved},
		},
		{
			name:     "two minority configs are both listed with all their sections",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgC, cfgA, cfgA, cfgB, cfgA)...),
			global:   firing(driftMessage, map[string]string{"nodes": "app-1.example.com, app-4.example.com", "sections": "FileSettings, SqlSettings, TeamSettings"}),
			nodes: []want{
				driftNode("app-1.example.com", "3", "FileSettings, SqlSettings"),
				resolved,
				resolved,
				driftNode("app-4.example.com", "3", "TeamSettings"),
				resolved,
			},
		},
		{
			name:     "a section only one node has",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgA, cfgD)...),
			global:   firing(driftMessage, map[string]string{"nodes": "app-3.example.com", "sections": "NewSettings"}),
			nodes:    []want{resolved, resolved, driftNode("app-3.example.com", "2", "NewSettings")},
		},
		{
			name:     "the most common config wins without a strict majority",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgA, cfgB, cfgC)...),
			global:   firing(driftMessage, map[string]string{"nodes": "app-3.example.com, app-4.example.com", "sections": "FileSettings, SqlSettings, TeamSettings"}),
			nodes: []want{
				resolved,
				resolved,
				driftNode("app-3.example.com", "2", "TeamSettings"),
				driftNode("app-4.example.com", "2", "FileSettings, SqlSettings"),
			},
		},
		{
			name:     "a tie for the most common config",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgB, cfgB, cfgA)...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", "sections": "TeamSettings"}),
			nodes: []want{
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", "TeamSettings"),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", "TeamSettings"),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", "TeamSettings"),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", "TeamSettings"),
			},
		},
		{
			name:     "a three-way tie lists every section that is not the same everywhere",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgB, cfgC)...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com | app-2.example.com | app-3.example.com", "sections": "FileSettings, SqlSettings, TeamSettings"}),
			nodes: []want{
				driftNoMajority("app-1.example.com | app-2.example.com | app-3.example.com", "FileSettings, SqlSettings, TeamSettings"),
				driftNoMajority("app-1.example.com | app-2.example.com | app-3.example.com", "FileSettings, SqlSettings, TeamSettings"),
				driftNoMajority("app-1.example.com | app-2.example.com | app-3.example.com", "FileSettings, SqlSettings, TeamSettings"),
			},
		},
		{
			name:     "two nodes with two configs",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgB, cfgA)...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com | app-2.example.com", "sections": "TeamSettings"}),
			nodes:    []want{driftNoMajority("app-1.example.com | app-2.example.com", "TeamSettings"), driftNoMajority("app-1.example.com | app-2.example.com", "TeamSettings")},
		},
		{
			name:     "a node without hashes is left out of the vote",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgA, nil)...),
			global:   resolved,
			nodes:    []want{resolved, resolved, diagUnknown},
		},
		{
			name:     "a node without hashes does not break a tie",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgB, nil)...),
			global:   firing(driftNoMajorityMessage, map[string]string{"groups": "app-1.example.com | app-2.example.com", "sections": "TeamSettings"}),
			nodes:    []want{driftNoMajority("app-1.example.com | app-2.example.com", "TeamSettings"), driftNoMajority("app-1.example.com | app-2.example.com", "TeamSettings"), diagUnknown},
		},
		{
			name:     "a node that did not reply to a live check is left out of the vote",
			snapshot: configSnapshot(clusterOn, noReply(driftNodes(cfgA, cfgA, cfgB), 2)...),
			global:   resolved,
			nodes:    []want{resolved, resolved, diagUnknown},
		},
		{
			name:     "no node reports hashes",
			snapshot: configSnapshot(clusterOn, driftNodes(nil, nil, nil)...),
			global:   diagUnknown,
			nodes:    []want{diagUnknown, diagUnknown, diagUnknown},
		},
		{
			name:     "a version mismatch",
			snapshot: configSnapshot(clusterOn, withBuild(driftNodes(cfgA, cfgB, cfgA), 1, "11.0.4", "abc123")...),
			global:   driftMixed,
			nodes:    []want{driftMixed, driftMixed, driftMixed},
		},
		{
			name:     "a hotfix rebuild of the same release",
			snapshot: configSnapshot(clusterOn, withBuild(driftNodes(cfgA, cfgA, cfgB), 2, "11.1.0", "def456")...),
			global:   driftMixed,
			nodes:    []want{driftMixed, driftMixed, driftMixed},
		},
		{
			name:     "without the cluster feature",
			snapshot: configSnapshot(clusterOn, unlicensed...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "cluster disabled",
			snapshot: configSnapshot(nil, driftNodes(cfgA, cfgB, cfgA)...),
			global:   resolved,
			nodes:    []want{resolved, resolved, resolved},
		},
		{
			name:     "config absent",
			snapshot: healthcheck.NewSnapshot(driftNodes(cfgA, cfgB)),
			global:   configUnknown,
			nodes:    []want{configUnknown, configUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			nodes := tc.snapshot.Nodes()
			require.Len(t, nodes, len(tc.nodes))

			// The vote iterates a map, so repeat to catch results that depend on its order.
			for range 20 {
				assertResult(t, tc.global, configDrift.Eval(tc.snapshot), "global")
				for i, node := range nodes {
					assertResult(t, tc.nodes[i], configDrift.EvalNode(tc.snapshot, node), node.Hostname)
				}
			}
		})
	}
}

func TestConfigDriftFingerprints(t *testing.T) {
	t.Parallel()

	registry := healthcheck.NewRegistry()
	registry.Register(configDrift)
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry})
	evaluations := engine.Evaluate(configSnapshot(clusterOn, driftNodes(cfgA, cfgB, cfgA)...))
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
