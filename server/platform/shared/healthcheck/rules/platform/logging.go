// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(logDebugProd, logFileOff, logWebhookPayloads, metricsOff)
}

const loggingConsolePath = "/admin_console/environment/logging"

var logDebugProd = healthcheck.Rule{
	Code:     "LOG_DEBUG_PROD",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.log_debug_prod.title"),
		RemediationID: healthcheck.TranslationId("health.rule.log_debug_prod.remediation"),
		ConsolePath:   loggingConsolePath,
	},
	Surface:    healthcheck.SurfaceInternal,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "LogSettings.FileLevel",
	Eval:       healthcheck.Gate(fileLogging, healthcheck.ReasonConfigUnavailable, evalLogDebugProd),
}

var logFileOff = healthcheck.Rule{
	Code:     "LOG_FILE_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.log_file_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.log_file_off.remediation"),
		ConsolePath:   loggingConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "LogSettings.EnableFile",
	Eval:       healthcheck.Single(evalLogFileOff),
}

var logWebhookPayloads = healthcheck.Rule{
	Code:     "LOG_WEBHOOK_PAYLOADS",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.log_webhook_payloads.title"),
		RemediationID: healthcheck.TranslationId("health.rule.log_webhook_payloads.remediation"),
		ConsolePath:   loggingConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "LogSettings.EnableWebhookDebugging",
	Eval:       healthcheck.Single(evalLogWebhookPayloads),
}

var metricsOff = healthcheck.Rule{
	Code:     "METRICS_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.metrics_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.metrics_off.remediation"),
		ConsolePath:   "/admin_console/environment/performance_monitoring",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "MetricsSettings.Enable",
	Eval:       healthcheck.Licensed(healthcheck.FeatureMetrics, healthcheck.Single(evalMetricsOff)),
}

func fileLogging(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LogSettings.EnableFile })
}

func isDebugLevel(level string) bool {
	return strings.EqualFold(level, "debug") || strings.EqualFold(level, "trace")
}

// debugTarget reports whether a log target writes debug entries. ok is false when either setting is unreadable.
func debugTarget(s *healthcheck.Snapshot, enabledSetting func(*model.Config) *bool, levelSetting func(*model.Config) *string) (debug, ok bool) {
	enabled, ok := s.ConfigBool(enabledSetting)
	if !ok {
		return false, false
	}
	if !enabled {
		return false, true
	}
	level, ok := s.ConfigString(levelSetting)
	return ok && isDebugLevel(level), ok
}

func evalLogWebhookPayloads(s *healthcheck.Snapshot) healthcheck.Result {
	fileDebug, fileOK := debugTarget(s,
		func(cfg *model.Config) *bool { return cfg.LogSettings.EnableFile },
		func(cfg *model.Config) *string { return cfg.LogSettings.FileLevel })
	consoleDebug, consoleOK := debugTarget(s,
		func(cfg *model.Config) *bool { return cfg.LogSettings.EnableConsole },
		func(cfg *model.Config) *string { return cfg.LogSettings.ConsoleLevel })
	if !fileDebug && !consoleDebug {
		if !fileOK || !consoleOK {
			return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
		}
		return healthcheck.Resolved()
	}

	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LogSettings.EnableWebhookDebugging })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case enabled:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.log_webhook_payloads.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalLogDebugProd(s *healthcheck.Snapshot) healthcheck.Result {
	level, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.LogSettings.FileLevel })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case isDebugLevel(level):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.log_debug_prod.message")).WithDetail("level", level)
	default:
		return healthcheck.Resolved()
	}
}

func evalLogFileOff(s *healthcheck.Snapshot) healthcheck.Result {
	enabled, ok := fileLogging(s)
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case !enabled:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.log_file_off.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalMetricsOff(s *healthcheck.Snapshot) healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.MetricsSettings.Enable })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case !enabled:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.metrics_off.message"))
	default:
		return healthcheck.Resolved()
	}
}
