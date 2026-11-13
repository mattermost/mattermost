// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
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

func TestLogWebhookPayloads(t *testing.T) {
	t.Parallel()

	webhookDebugging := func(enabled bool) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.LogSettings.EnableWebhookDebugging = new(enabled)
		}
	}
	consoleLog := func(enabled bool, level string) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.LogSettings.EnableConsole = new(enabled)
			cfg.LogSettings.ConsoleLevel = new(level)
		}
	}
	quietConsole := consoleLog(true, "INFO")
	advancedTarget := func(targetType string, levels string) func(*model.Config) {
		return func(cfg *model.Config) {
			cfg.LogSettings.EnableFile = new(false)
			cfg.LogSettings.EnableConsole = new(false)
			cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"adv": {"type": "` + targetType + `", "format": "json", "levels": [` + levels + `]}}`)
		}
	}
	debugLevels := `{"id": 4, "name": "info"}, {"id": 5, "name": "debug"}`
	advancedLicense := func(allowed bool) *healthcheck.NodeSnapshot {
		return leaderNode(func(diag *model.SupportPacketDiagnostics) {
			diag.License.SkuShortName = model.LicenseShortSkuEnterprise
			diag.License.Features = &model.Features{AdvancedLogging: new(allowed)}
		})
	}
	unlicensed := leaderNode(nil)
	payloadsLogged := firing("health.rule.log_webhook_payloads.message", nil)

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config section absent", &healthcheck.Snapshot{}, configUnknown},
		{"defaults", configSnapshot(nil), resolved},
		{"webhook debugging on with default log levels", configSnapshot(webhookDebugging(true)), payloadsLogged},
		{"webhook debugging off with debug logging", configSnapshot(all(webhookDebugging(false), fileLog(true, "DEBUG"), consoleLog(true, "DEBUG"))), resolved},
		{"webhook debugging on at info level", configSnapshot(all(webhookDebugging(true), fileLog(true, "INFO"), quietConsole)), resolved},
		{"webhook debugging on with file at debug", configSnapshot(all(webhookDebugging(true), fileLog(true, "DEBUG"), quietConsole)), payloadsLogged},
		{"webhook debugging on with file at trace", configSnapshot(all(webhookDebugging(true), fileLog(true, "trace"), quietConsole)), payloadsLogged},
		{"webhook debugging on with console at debug", configSnapshot(all(webhookDebugging(true), fileLog(true, "INFO"), consoleLog(true, "debug"))), payloadsLogged},
		{"webhook debugging on with disabled debug targets", configSnapshot(all(webhookDebugging(true), fileLog(false, "DEBUG"), consoleLog(false, "DEBUG"))), resolved},
		{"webhook debugging flag unreadable at info level", configSnapshot(all(quietConsole, func(cfg *model.Config) { cfg.LogSettings.EnableWebhookDebugging = nil })), resolved},
		{"webhook debugging flag unreadable with file at debug", configSnapshot(all(fileLog(true, "DEBUG"), func(cfg *model.Config) { cfg.LogSettings.EnableWebhookDebugging = nil })), configUnknown},
		{
			name: "file level unreadable without a debug target",
			snapshot: configSnapshot(all(webhookDebugging(true), quietConsole, func(cfg *model.Config) {
				cfg.LogSettings.FileLevel = nil
			})),
			want: configUnknown,
		},
		{
			name: "file level unreadable with console at debug",
			snapshot: configSnapshot(all(webhookDebugging(true), consoleLog(true, "DEBUG"), func(cfg *model.Config) {
				cfg.LogSettings.FileLevel = nil
			})),
			want: payloadsLogged,
		},
		{"advanced file target at debug", configSnapshot(all(webhookDebugging(true), advancedTarget("file", debugLevels))), payloadsLogged},
		{"advanced target at trace", configSnapshot(all(webhookDebugging(true), advancedTarget("file", `{"id": 6, "name": "trace"}`))), payloadsLogged},
		{"advanced target at info", configSnapshot(all(webhookDebugging(true), advancedTarget("file", `{"id": 4, "name": "info"}`))), resolved},
		{"advanced debug target with webhook debugging off", configSnapshot(all(webhookDebugging(false), advancedTarget("file", debugLevels))), resolved},
		{"advanced console target at debug when unlicensed", configSnapshot(all(webhookDebugging(true), advancedTarget("Console", debugLevels)), unlicensed), payloadsLogged},
		{"advanced syslog target at debug when unlicensed", configSnapshot(all(webhookDebugging(true), advancedTarget("syslog", debugLevels)), unlicensed), resolved},
		{"advanced syslog target at debug without advanced logging", configSnapshot(all(webhookDebugging(true), advancedTarget("syslog", debugLevels)), advancedLicense(false)), resolved},
		{"advanced syslog target at debug with advanced logging", configSnapshot(all(webhookDebugging(true), advancedTarget("syslog", debugLevels)), advancedLicense(true)), payloadsLogged},
		{"advanced syslog target at debug with license unknown", configSnapshot(all(webhookDebugging(true), advancedTarget("syslog", debugLevels))), payloadsLogged},
		{
			name: "advanced logging unreadable without another debug target",
			snapshot: configSnapshot(all(webhookDebugging(true), fileLog(false, "DEBUG"), consoleLog(false, "DEBUG"), func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"broken": `)
			})),
			want: configUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, logWebhookPayloads.Eval(tc.snapshot))
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
