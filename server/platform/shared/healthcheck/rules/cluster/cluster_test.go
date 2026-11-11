// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type want struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var (
	resolved       = want{state: healthcheck.StateResolved}
	configUnknown  = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	statsUnknown   = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonStatsUnavailable}
	diagUnknown    = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
	licenseUnknown = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonLicenseUnavailable}
)

func clusterLicense() model.SupportPacketLicense {
	return model.SupportPacketLicense{
		SkuShortName: model.LicenseShortSkuEnterprise,
		Features:     &model.Features{Cluster: new(true)},
	}
}

// licensedLeader is a leader that carries only a cluster license, so every other diagnostic reads as not collected.
func licensedLeader() *healthcheck.NodeSnapshot {
	return &healthcheck.NodeSnapshot{
		Hostname:    "app-1.example.com",
		IsLeader:    true,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{License: clusterLicense()}},
	}
}

func firing(messageID string, details map[string]string) want {
	return want{state: healthcheck.StateFiring, messageID: messageID, details: details}
}

func (w want) withValue(v float64) want {
	w.value = &v
	return w
}

// configSnapshot returns a snapshot over nodes whose config holds the server defaults, changed by mutate.
// Without nodes it gets a licensedLeader.
func configSnapshot(mutate func(*model.Config), nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	if mutate != nil {
		mutate(cfg)
	}
	if len(nodes) == 0 {
		nodes = []*healthcheck.NodeSnapshot{licensedLeader()}
	}

	s := healthcheck.NewSnapshot(nodes)
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	return s
}

func withUsers(s *healthcheck.Snapshot, users int64) *healthcheck.Snapshot {
	s.Stats = &model.SupportPacketStats{RegisteredUsers: new(users)}
	s.Sections[model.SectionStats] = nil
	return s
}

func all(mutations ...func(*model.Config)) func(*model.Config) {
	return func(cfg *model.Config) {
		for _, mutate := range mutations {
			mutate(cfg)
		}
	}
}

func haEnabled(cfg *model.Config) {
	cfg.ClusterSettings.Enable = new(true)
	cfg.ClusterSettings.ClusterName = new("production")
}

// diagNode returns a packet-style node on a cluster license with every section collected, changed by mutate.
func diagNode(hostname string, leader bool, mutate func(*model.SupportPacketDiagnostics)) *healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{License: clusterLicense()}
	diag.Server.Version = "11.1.0"
	diag.Config.Source = "postgres://mmuser:****@db.example.com:5432/mattermost"
	diag.Cluster.NumberOfNodes = new(3)
	diag.Cluster.NumberOfConnectedNodes = new(3)
	if mutate != nil {
		mutate(diag)
	}

	errs := model.SectionErrors{}
	for _, section := range model.AllNodeSections() {
		errs[section] = nil
	}

	return &healthcheck.NodeSnapshot{
		Hostname:    hostname,
		IsLeader:    leader,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag, Errors: errs},
	}
}

func leaderNode(mutate func(*model.SupportPacketDiagnostics)) *healthcheck.NodeSnapshot {
	return diagNode("app-1.example.com", true, mutate)
}

func assertResult(t *testing.T, expected want, results []healthcheck.Result, msgAndArgs ...any) {
	t.Helper()

	require.Len(t, results, 1, msgAndArgs...)
	assert.Equal(t, expected.state, results[0].State, msgAndArgs...)
	assert.Equal(t, expected.messageID, results[0].MessageID, msgAndArgs...)
	assert.Equal(t, expected.details, results[0].Details, msgAndArgs...)
	assert.Equal(t, expected.value, results[0].Value, msgAndArgs...)
}

func assertRules(t *testing.T, rules []healthcheck.Rule, s *healthcheck.Snapshot, wants map[string]want) {
	t.Helper()

	for _, rule := range rules {
		expected, ok := wants[rule.Code]
		require.True(t, ok, "no expectation for %s", rule.Code)
		assertResult(t, expected, rule.Eval(s), rule.Code)
	}
}

// TestLicenseGate checks that every rule ignores cluster settings the server cannot act on without the Cluster feature.
func TestLicenseGate(t *testing.T) {
	t.Parallel()

	withLicense := func(license model.SupportPacketLicense) func(*model.SupportPacketDiagnostics) {
		return func(diag *model.SupportPacketDiagnostics) {
			nodes(1)(diag)
			fileSource(diag)
			diag.License = license
		}
	}
	snapshot := func(leader *healthcheck.NodeSnapshot) *healthcheck.Snapshot {
		wrong := all(haEnabled, func(cfg *model.Config) {
			cfg.ClusterSettings.EnableGossipEncryption = new(false)
			cfg.ClusterSettings.ReadOnlyConfig = new(false)
			cfg.ClusterSettings.AdvertiseAddress = new("127.0.0.1")
		})
		follower := diagNode("app-2.example.com", false, func(diag *model.SupportPacketDiagnostics) { diag.Server.Version = "11.0.0" })
		return withUsers(configSnapshot(wrong, leader, follower, diagNode("app-3.example.com", false, nil)), 200_000)
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"unlicensed", snapshot(leaderNode(withLicense(model.SupportPacketLicense{}))), resolved},
		{"feature off", snapshot(leaderNode(withLicense(model.SupportPacketLicense{
			SkuShortName: model.LicenseShortSkuProfessional,
			Features:     &model.Features{Cluster: new(false)},
		}))), resolved},
		{"license section failed", snapshot(func() *healthcheck.NodeSnapshot {
			node := leaderNode(withLicense(clusterLicense()))
			node.Diagnostics.Errors[model.SectionLicense] = errors.New("boom")
			return node
		}()), licenseUnknown},
	}

	rules := []healthcheck.Rule{clusterGossipUnencrypted, clusterLRUCache, clusterSingleNode, clusterBadAdvertise, clusterConfigWritable, versionSkew}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for _, rule := range rules {
				assertResult(t, tc.want, rule.Eval(tc.snapshot), rule.Code)
			}
			// Only the skewed follower fires; nodes that resolve anyway stay resolved without license data.
			for _, node := range tc.snapshot.Nodes() {
				nodeWant := resolved
				if node.Hostname == "app-2.example.com" {
					nodeWant = tc.want
				}
				assertResult(t, nodeWant, versionSkew.EvalNode(tc.snapshot, node), node.Hostname)
			}
		})
	}

	t.Run("licensed fires", func(t *testing.T) {
		t.Parallel()

		s := snapshot(leaderNode(withLicense(clusterLicense())))
		for _, rule := range rules {
			assert.Equal(t, healthcheck.StateFiring, rule.Eval(s)[0].State, rule.Code)
		}
	})
}

func TestRegistered(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		rule       healthcheck.Rule
		code       string
		severity   healthcheck.Severity
		surface    healthcheck.Surface
		volatility healthcheck.Volatility
		subject    string
		global     bool
		nodeScoped bool
	}{
		{clusterGossipUnencrypted, "CLUSTER_GOSSIP_UNENCRYPTED", healthcheck.SeverityInfo, healthcheck.SurfaceProduct, healthcheck.VolatilityStable, "ClusterSettings.EnableGossipEncryption", true, false},
		{clusterLRUCache, "CLUSTER_LRU_CACHE", healthcheck.SeverityInfo, healthcheck.SurfaceProduct, healthcheck.VolatilityThreshold, "CacheSettings.CacheType", true, false},
		{clusterSingleNode, "CLUSTER_SINGLE_NODE", healthcheck.SeverityCritical, healthcheck.SurfaceProduct, healthcheck.VolatilityTopology, "ClusterSettings.Enable", true, false},
		{clusterBadAdvertise, "CLUSTER_BAD_ADVERTISE", healthcheck.SeverityCritical, healthcheck.SurfaceProduct, healthcheck.VolatilityStable, "ClusterSettings.AdvertiseAddress", true, false},
		{clusterConfigWritable, "CLUSTER_CONFIG_WRITABLE", healthcheck.SeverityWarning, healthcheck.SurfaceProduct, healthcheck.VolatilityStable, "ClusterSettings.ReadOnlyConfig", true, false},
		{versionSkew, "CLUSTER_VERSION_SKEW", healthcheck.SeverityWarning, healthcheck.SurfaceProduct, healthcheck.VolatilityTopology, "cluster.version", true, true},
		{nodeNotResponding, "NODE_NOT_RESPONDING", healthcheck.SeverityWarning, healthcheck.SurfaceProduct, healthcheck.VolatilityTopology, "cluster.node", false, true},
	}

	registry := healthcheck.Builtin()
	for _, tc := range testCases {
		t.Run(tc.code, func(t *testing.T) {
			t.Parallel()

			registered, ok := registry.Get(tc.code)
			require.True(t, ok)

			for _, rule := range []healthcheck.Rule{tc.rule, registered} {
				assert.Equal(t, tc.code, rule.Code)
				assert.Equal(t, model.AreaCluster, rule.Area)
				assert.Equal(t, tc.surface, rule.Surface)
				assert.Equal(t, tc.severity, rule.Severity)
				assert.Equal(t, tc.volatility, rule.Volatility)
				assert.Equal(t, tc.subject, rule.Subject)
				assert.False(t, rule.AppliesToCloud)
				assert.Equal(t, tc.global, rule.Eval != nil)
				assert.Equal(t, tc.nodeScoped, rule.EvalNode != nil)
			}
		})
	}
}
