// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

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
}

var (
	resolved      = want{state: healthcheck.StateResolved}
	configUnknown = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	diagUnknown   = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
)

func firing(messageID string, details map[string]string) want {
	return want{state: healthcheck.StateFiring, messageID: messageID, details: details}
}

// defaultConfig returns a config with server defaults, changed by mutate.
func defaultConfig(mutate func(*model.Config)) *model.SupportPacketConfig {
	cfg := &model.Config{}
	cfg.SetDefaults()
	if mutate != nil {
		mutate(cfg)
	}
	return &model.SupportPacketConfig{Config: cfg}
}

func all(mutations ...func(*model.Config)) func(*model.Config) {
	return func(cfg *model.Config) {
		for _, mutate := range mutations {
			mutate(cfg)
		}
	}
}

// configSnapshot returns a snapshot over nodes whose config section holds defaultConfig(mutate).
func configSnapshot(mutate func(*model.Config), nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	s := healthcheck.NewSnapshot(nodes)
	s.Config = defaultConfig(mutate)
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	return s
}

// diagNode returns a node with every section collected and healthy Linux diagnostics, changed by mutate.
func diagNode(hostname string, leader bool, mutate func(*model.SupportPacketDiagnostics)) *healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.Server.OS = "linux"
	diag.Server.OpenFileDescriptors = new(int64(120))
	diag.Server.MaxFileDescriptors = new(int64(65536))
	diag.FileStore.Status = model.StatusOk
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
	return diagNode("mm.example.com", true, mutate)
}

func assertRules(t *testing.T, rules []healthcheck.Rule, s *healthcheck.Snapshot, wants map[string]want) {
	t.Helper()

	for _, rule := range rules {
		results := rule.Eval(s)
		require.Len(t, results, 1, rule.Code)

		expected, ok := wants[rule.Code]
		require.True(t, ok, "no expectation for %s", rule.Code)
		assert.Equal(t, expected.state, results[0].State, rule.Code)
		assert.Equal(t, expected.messageID, results[0].MessageID, rule.Code)
		assert.Equal(t, expected.details, results[0].Details, rule.Code)
	}
}

func TestRegistered(t *testing.T) {
	testCases := []struct {
		rule           healthcheck.Rule
		code           string
		severity       healthcheck.Severity
		volatility     healthcheck.Volatility
		subject        string
		appliesToCloud bool
		nodeScoped     bool
	}{
		{filestoreLocalInCluster, "FILESTORE_LOCAL_IN_CLUSTER", healthcheck.SeverityCritical, healthcheck.VolatilityStable, "FileSettings.DriverName", false, false},
		{filestoreLocalInClusterVerify, "FILESTORE_LOCAL_IN_CLUSTER_VERIFY", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "FileSettings.Directory", false, false},
		{filestoreS3NoBucket, "FILESTORE_S3_NO_BUCKET", healthcheck.SeverityCritical, healthcheck.VolatilityStable, "FileSettings.AmazonS3Bucket", false, false},
		{filestoreS3SSLOff, "FILESTORE_S3_SSL_OFF", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "FileSettings.AmazonS3SSL", false, false},
		{filestoreUnreachable, "FILESTORE_UNREACHABLE", healthcheck.SeverityWarning, healthcheck.VolatilityProbe, "FileSettings.DriverName", false, false},
		{logDebugProd, "LOG_DEBUG_PROD", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "LogSettings.FileLevel", false, false},
		{logFileOff, "LOG_FILE_OFF", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "LogSettings.EnableFile", false, false},
		{metricsOff, "METRICS_OFF", healthcheck.SeverityInfo, healthcheck.VolatilityStable, "MetricsSettings.Enable", false, false},
		{pluginsOff, "PLUGINS_OFF", healthcheck.SeverityInfo, healthcheck.VolatilityStable, "PluginSettings.Enable", false, false},
		{pluginHealthOff, "PLUGIN_HEALTH_OFF", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "PluginSettings.EnableHealthCheck", false, false},
		{pluginNotRunning, "PLUGIN_NOT_RUNNING", healthcheck.SeverityWarning, healthcheck.VolatilityProbe, "PluginSettings.PluginStates", true, false},
		{envUnsupportedOS, "ENV_UNSUPPORTED_OS", healthcheck.SeverityCritical, healthcheck.VolatilityStable, "Server.OS", false, false},
		{bindPrivilegedPort, "BIND_PRIVILEGED_PORT", healthcheck.SeverityWarning, healthcheck.VolatilityStable, "ServiceSettings.ListenAddress", false, false},
		{nodeFDExhaustion, "NODE_FD_EXHAUSTION", healthcheck.SeverityCritical, healthcheck.VolatilityThreshold, "Server.FileDescriptors", false, true},
	}

	registry := healthcheck.Builtin()
	for _, tc := range testCases {
		t.Run(tc.code, func(t *testing.T) {
			registered, ok := registry.Get(tc.code)
			require.True(t, ok)

			for _, rule := range []healthcheck.Rule{tc.rule, registered} {
				assert.Equal(t, tc.code, rule.Code)
				assert.Equal(t, model.AreaPlatform, rule.Area)
				assert.Equal(t, healthcheck.SurfaceProduct, rule.Surface)
				assert.Equal(t, tc.severity, rule.Severity)
				assert.Equal(t, tc.volatility, rule.Volatility)
				assert.Equal(t, tc.subject, rule.Subject)
				assert.Equal(t, tc.appliesToCloud, rule.AppliesToCloud)
				assert.Equal(t, tc.nodeScoped, rule.EvalNode != nil)
				assert.Equal(t, !tc.nodeScoped, rule.Eval != nil)
			}
		})
	}
}
