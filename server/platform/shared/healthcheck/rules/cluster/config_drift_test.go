// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"fmt"
	"strconv"
	"strings"
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

// Configs that nodes report: b differs from a in TeamSettings.SiteName, c in
// FileSettings.MaxFileSize and SqlSettings.MaxOpenConns, and d has a plugin setting the others
// lack. Each call returns a fresh config.
var (
	cfgA = driftConfig(nil)
	cfgB = driftConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "Drifted" })
	cfgC = driftConfig(func(cfg *model.Config) {
		*cfg.FileSettings.MaxFileSize = 1
		*cfg.SqlSettings.MaxOpenConns = 999
	})
	cfgD = driftConfig(func(cfg *model.Config) {
		cfg.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"enabled": true}
	})
)

const (
	settingsB  = "TeamSettings.SiteName"
	settingsC  = "FileSettings.MaxFileSize, SqlSettings.MaxOpenConns"
	settingsBC = "FileSettings.MaxFileSize, SqlSettings.MaxOpenConns, TeamSettings.SiteName"
	settingsD  = "PluginSettings.Plugins.com.example.plugin.enabled"
)

func driftConfig(mutate func(*model.Config)) func() *model.SupportPacketConfig {
	return func() *model.SupportPacketConfig {
		cfg := &model.Config{}
		cfg.SetDefaults()
		if mutate != nil {
			mutate(cfg)
		}
		return &model.SupportPacketConfig{Config: cfg, FeatureFlags: *cfg.FeatureFlags}
	}
}

// settingDetails is the settings and count details for a list of at most maxListedSettings paths.
func settingDetails(details map[string]string, settings string) map[string]string {
	details["settings"] = settings
	details["count"] = strconv.Itoa(len(strings.Split(settings, ", ")))
	return details
}

func driftFiring(nodes, settings string) want {
	return firing(driftMessage, settingDetails(map[string]string{"nodes": nodes}, settings))
}

func driftTie(groups, settings string) want {
	return firing(driftNoMajorityMessage, settingDetails(map[string]string{"groups": groups}, settings))
}

func driftNoMajority(groups, settings string) want {
	return want{state: healthcheck.StateUnknown, messageID: driftNoMajorityMessage, details: settingDetails(map[string]string{"groups": groups}, settings)}
}

func driftNode(node, majority, settings string) want {
	return firing(driftNodeMessage, settingDetails(map[string]string{"node": node, "majority": majority}, settings))
}

// driftNodes builds nodes on one build that report the given configs, the first one leading. A
// nil config is a node without one: one on an older build, or a packet node whose config could
// not be read.
func driftNodes(configs ...func() *model.SupportPacketConfig) []*healthcheck.NodeSnapshot {
	nodes := make([]*healthcheck.NodeSnapshot, 0, len(configs))
	for i, config := range configs {
		hostname := fmt.Sprintf("app-%d.example.com", i+1)
		node := diagNode(hostname, i == 0, func(diag *model.SupportPacketDiagnostics) {
			diag.Server.BuildHash = "abc123"
		})
		if config != nil {
			node.Diagnostics.Config = config()
		}
		nodes = append(nodes, node)
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
			global:   driftFiring("app-2.example.com", settingsB),
			nodes:    []want{resolved, driftNode("app-2.example.com", "2", settingsB), resolved},
		},
		{
			name:     "two minority configs are both listed with all their settings",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgC, cfgA, cfgA, cfgB, cfgA)...),
			global:   driftFiring("app-1.example.com, app-4.example.com", settingsBC),
			nodes: []want{
				driftNode("app-1.example.com", "3", settingsC),
				resolved,
				resolved,
				driftNode("app-4.example.com", "3", settingsB),
				resolved,
			},
		},
		{
			name:     "a setting only one node has",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgA, cfgD)...),
			global:   driftFiring("app-3.example.com", settingsD),
			nodes:    []want{resolved, resolved, driftNode("app-3.example.com", "2", settingsD)},
		},
		{
			name:     "the most common config wins without a strict majority",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgA, cfgB, cfgC)...),
			global:   driftFiring("app-3.example.com, app-4.example.com", settingsBC),
			nodes: []want{
				resolved,
				resolved,
				driftNode("app-3.example.com", "2", settingsB),
				driftNode("app-4.example.com", "2", settingsC),
			},
		},
		{
			name:     "a tie for the most common config",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgB, cfgB, cfgA)...),
			global:   driftTie("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", settingsB),
			nodes: []want{
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", settingsB),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", settingsB),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", settingsB),
				driftNoMajority("app-1.example.com, app-4.example.com | app-2.example.com, app-3.example.com", settingsB),
			},
		},
		{
			name:     "a three-way tie lists every setting that is not the same everywhere",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgA, cfgB, cfgC)...),
			global:   driftTie("app-1.example.com | app-2.example.com | app-3.example.com", settingsBC),
			nodes: []want{
				driftNoMajority("app-1.example.com | app-2.example.com | app-3.example.com", settingsBC),
				driftNoMajority("app-1.example.com | app-2.example.com | app-3.example.com", settingsBC),
				driftNoMajority("app-1.example.com | app-2.example.com | app-3.example.com", settingsBC),
			},
		},
		{
			name:     "two nodes with two configs",
			snapshot: configSnapshot(clusterOn, driftNodes(cfgB, cfgA)...),
			global:   driftTie("app-1.example.com | app-2.example.com", settingsB),
			nodes:    []want{driftNoMajority("app-1.example.com | app-2.example.com", settingsB), driftNoMajority("app-1.example.com | app-2.example.com", settingsB)},
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
			global:   driftTie("app-1.example.com | app-2.example.com", settingsB),
			nodes:    []want{driftNoMajority("app-1.example.com | app-2.example.com", settingsB), driftNoMajority("app-1.example.com | app-2.example.com", settingsB), diagUnknown},
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

func TestConfigDriftListsAtMostTenSettings(t *testing.T) {
	t.Parallel()

	manySettings := driftConfig(func(cfg *model.Config) {
		settings := map[string]any{}
		for i := range 12 {
			settings[fmt.Sprintf("setting%02d", i)] = i
		}
		cfg.PluginSettings.Plugins["com.example.plugin"] = settings
	})
	s := configSnapshot(clusterOn, driftNodes(cfgA, cfgA, manySettings)...)

	results := configDrift.EvalNode(s, s.Nodes()[2])
	require.Len(t, results, 1)
	assert.Equal(t, "12", results[0].Details["count"])
	listed := strings.Split(results[0].Details["settings"], ", ")
	require.Len(t, listed, maxListedSettings)
	assert.Equal(t, "PluginSettings.Plugins.com.example.plugin.setting00", listed[0])
	assert.Equal(t, "PluginSettings.Plugins.com.example.plugin.setting09", listed[9])
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
