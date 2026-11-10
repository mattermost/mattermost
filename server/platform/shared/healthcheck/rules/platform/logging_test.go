// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func fileLog(enabled bool, level string) func(*model.Config) {
	return func(cfg *model.Config) {
		cfg.LogSettings.EnableFile = new(enabled)
		cfg.LogSettings.FileLevel = new(level)
	}
}

func TestLoggingRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{logDebugProd, logFileOff}
	debugFiring := func(level string) want {
		return firing("health.rule.log_debug_prod.message", map[string]string{"level": level})
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "config section absent",
			snapshot: &healthcheck.Snapshot{},
			want:     map[string]want{"LOG_DEBUG_PROD": configUnknown, "LOG_FILE_OFF": configUnknown},
		},
		{
			name:     "defaults",
			snapshot: configSnapshot(nil),
			want:     map[string]want{"LOG_DEBUG_PROD": resolved, "LOG_FILE_OFF": resolved},
		},
		{
			name:     "file level DEBUG",
			snapshot: configSnapshot(fileLog(true, "DEBUG")),
			want:     map[string]want{"LOG_DEBUG_PROD": debugFiring("DEBUG"), "LOG_FILE_OFF": resolved},
		},
		{
			name:     "file level debug",
			snapshot: configSnapshot(fileLog(true, "debug")),
			want:     map[string]want{"LOG_DEBUG_PROD": debugFiring("debug"), "LOG_FILE_OFF": resolved},
		},
		{
			name:     "file level trace",
			snapshot: configSnapshot(fileLog(true, "trace")),
			want:     map[string]want{"LOG_DEBUG_PROD": debugFiring("trace"), "LOG_FILE_OFF": resolved},
		},
		{
			name:     "file level INFO",
			snapshot: configSnapshot(fileLog(true, "INFO")),
			want:     map[string]want{"LOG_DEBUG_PROD": resolved, "LOG_FILE_OFF": resolved},
		},
		{
			name:     "file logging off with DEBUG",
			snapshot: configSnapshot(fileLog(false, "DEBUG")),
			want: map[string]want{
				"LOG_DEBUG_PROD": resolved,
				"LOG_FILE_OFF":   firing("health.rule.log_file_off.message", nil),
			},
		},
		{
			name: "file logging flag unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = nil
			}),
			want: map[string]want{"LOG_DEBUG_PROD": configUnknown, "LOG_FILE_OFF": configUnknown},
		},
		{
			name: "file level unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.LogSettings.FileLevel = nil
			}),
			want: map[string]want{"LOG_DEBUG_PROD": configUnknown, "LOG_FILE_OFF": resolved},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, rules, tc.snapshot, tc.want)
		})
	}
}

func TestMetricsOff(t *testing.T) {
	t.Parallel()

	licensedFor := func(metrics *bool) *healthcheck.NodeSnapshot {
		return leaderNode(func(diag *model.SupportPacketDiagnostics) {
			diag.License.SkuShortName = model.LicenseShortSkuEnterprise
			diag.License.Features = &model.Features{Metrics: metrics}
		})
	}
	licenseUnknown := want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonLicenseUnavailable}
	metricsOn := func(cfg *model.Config) {
		cfg.MetricsSettings.Enable = new(true)
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"license unavailable", configSnapshot(nil), licenseUnknown},
		{"metrics feature not recorded runs the rule", configSnapshot(nil, licensedFor(nil)), firing("health.rule.metrics_off.message", nil)},
		{"not licensed for metrics", configSnapshot(nil, licensedFor(new(false))), resolved},
		{"licensed with metrics off", configSnapshot(nil, licensedFor(new(true))), firing("health.rule.metrics_off.message", nil)},
		{"licensed with metrics on", configSnapshot(metricsOn, licensedFor(new(true))), resolved},
		{"licensed with metrics flag unreadable", configSnapshot(func(cfg *model.Config) { cfg.MetricsSettings.Enable = nil }, licensedFor(new(true))), configUnknown},
		{"licensed with config section absent", healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{licensedFor(new(true))}), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, metricsOff.Eval(tc.snapshot))
		})
	}
}
