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

func TestLoggingAndMetricsRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{logDebugProd, logFileOff, metricsOff}
	metricsFiring := firing("health.rule.metrics_off.message", nil)
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
			want:     map[string]want{"LOG_DEBUG_PROD": configUnknown, "LOG_FILE_OFF": configUnknown, "METRICS_OFF": configUnknown},
		},
		{
			name:     "defaults fire only the optional metrics finding",
			snapshot: configSnapshot(nil),
			want:     map[string]want{"LOG_DEBUG_PROD": resolved, "LOG_FILE_OFF": resolved, "METRICS_OFF": metricsFiring},
		},
		{
			name:     "file level DEBUG",
			snapshot: configSnapshot(fileLog(true, "DEBUG")),
			want:     map[string]want{"LOG_DEBUG_PROD": debugFiring("DEBUG"), "LOG_FILE_OFF": resolved, "METRICS_OFF": metricsFiring},
		},
		{
			name:     "file level debug",
			snapshot: configSnapshot(fileLog(true, "debug")),
			want:     map[string]want{"LOG_DEBUG_PROD": debugFiring("debug"), "LOG_FILE_OFF": resolved, "METRICS_OFF": metricsFiring},
		},
		{
			name:     "file level trace",
			snapshot: configSnapshot(fileLog(true, "trace")),
			want:     map[string]want{"LOG_DEBUG_PROD": debugFiring("trace"), "LOG_FILE_OFF": resolved, "METRICS_OFF": metricsFiring},
		},
		{
			name:     "file level INFO",
			snapshot: configSnapshot(fileLog(true, "INFO")),
			want:     map[string]want{"LOG_DEBUG_PROD": resolved, "LOG_FILE_OFF": resolved, "METRICS_OFF": metricsFiring},
		},
		{
			name:     "file logging off with DEBUG",
			snapshot: configSnapshot(fileLog(false, "DEBUG")),
			want: map[string]want{
				"LOG_DEBUG_PROD": resolved,
				"LOG_FILE_OFF":   firing("health.rule.log_file_off.message", nil),
				"METRICS_OFF":    metricsFiring,
			},
		},
		{
			name: "file logging flag unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = nil
			}),
			want: map[string]want{"LOG_DEBUG_PROD": configUnknown, "LOG_FILE_OFF": configUnknown, "METRICS_OFF": metricsFiring},
		},
		{
			name: "file level unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.LogSettings.FileLevel = nil
			}),
			want: map[string]want{"LOG_DEBUG_PROD": configUnknown, "LOG_FILE_OFF": resolved, "METRICS_OFF": metricsFiring},
		},
		{
			name: "metrics on",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.MetricsSettings.Enable = new(true)
			}),
			want: map[string]want{"LOG_DEBUG_PROD": resolved, "LOG_FILE_OFF": resolved, "METRICS_OFF": resolved},
		},
		{
			name: "metrics flag unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.MetricsSettings.Enable = nil
			}),
			want: map[string]want{"LOG_DEBUG_PROD": resolved, "LOG_FILE_OFF": resolved, "METRICS_OFF": configUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, rules, tc.snapshot, tc.want)
		})
	}
}
