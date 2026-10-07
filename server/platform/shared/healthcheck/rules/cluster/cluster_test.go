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

type want struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var (
	resolved      = want{state: healthcheck.StateResolved}
	configUnknown = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	statsUnknown  = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonStatsUnavailable}
	diagUnknown   = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
)

func firing(messageID string, details map[string]string) want {
	return want{state: healthcheck.StateFiring, messageID: messageID, details: details}
}

func (w want) withValue(v float64) want {
	w.value = &v
	return w
}

// configSnapshot returns a snapshot over nodes whose config holds the server defaults, changed by mutate.
func configSnapshot(mutate func(*model.Config), nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	if mutate != nil {
		mutate(cfg)
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

// diagNode returns a packet-style node with every section collected, changed by mutate.
func diagNode(hostname string, leader bool, mutate func(*model.SupportPacketDiagnostics)) *healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.Server.Version = "11.1.0"
	diag.Config.Source = "postgres://mmuser:****@db.example.com:5432/mattermost"
	diag.Cluster.NumberOfNodes = new(3)
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

func TestRegistered(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		rule       healthcheck.Rule
		code       string
		severity   healthcheck.Severity
		volatility healthcheck.Volatility
		subject    string
		nodeScoped bool
	}{
		{clusterGossipUnencrypted, "CLUSTER_GOSSIP_UNENCRYPTED", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "ClusterSettings.EnableGossipEncryption", false},
		{clusterLRUCache, "CLUSTER_LRU_CACHE", healthcheck.SeverityInfo, healthcheck.VolatilityThreshold, "CacheSettings.CacheType", false},
		{rateLimitOffLarge, "RATELIMIT_OFF_LARGE", healthcheck.SeverityWarning, healthcheck.VolatilityThreshold, "RateLimitSettings.Enable", false},
		{rateLimitStoreSmall, "RATELIMIT_STORE_SMALL", healthcheck.SeverityInfo, healthcheck.VolatilityStable, "RateLimitSettings.MemoryStoreSize", false},
		{clusterSingleNode, "CLUSTER_SINGLE_NODE", healthcheck.SeverityCritical, healthcheck.VolatilityTopology, "ClusterSettings.Enable", false},
		{clusterBadAdvertise, "CLUSTER_BAD_ADVERTISE", healthcheck.SeverityCritical, healthcheck.VolatilityStable, "ClusterSettings.AdvertiseAddress", false},
		{clusterConfigWritable, "CLUSTER_CONFIG_WRITABLE", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "ClusterSettings.ReadOnlyConfig", false},
		{versionSkew, "CLUSTER_VERSION_SKEW", healthcheck.SeverityWarning, healthcheck.VolatilityTopology, "cluster.version", true},
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
				assert.Equal(t, healthcheck.SurfaceProduct, rule.Surface)
				assert.Equal(t, tc.severity, rule.Severity)
				assert.Equal(t, tc.volatility, rule.Volatility)
				assert.Equal(t, tc.subject, rule.Subject)
				assert.False(t, rule.AppliesToCloud)
				assert.NotNil(t, rule.Eval)
				assert.Equal(t, tc.nodeScoped, rule.EvalNode != nil)
			}
		})
	}
}
