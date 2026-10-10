// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(logDebugProd, logFileOff, metricsOff)
}

const loggingConsolePath = "/admin_console/environment/logging"

var logDebugProd = healthcheck.Rule{
	Code:     "LOG_DEBUG_PROD",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.log_debug_prod.title"),
		RemediationID: healthcheck.TranslationId("health.rule.log_debug_prod.remediation"),
		ConsolePath:   loggingConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "LogSettings.FileLevel",
	Eval:       evalLogDebugProd,
}

var logFileOff = healthcheck.Rule{
	Code:     "LOG_FILE_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.log_file_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.log_file_off.remediation"),
		ConsolePath:   loggingConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "LogSettings.EnableFile",
	Eval:       evalLogFileOff,
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
	Eval:       evalMetricsOff,
}

func fileLogging(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LogSettings.EnableFile })
}

func evalLogDebugProd(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := fileLogging(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	level, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.LogSettings.FileLevel })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case strings.EqualFold(level, "debug"), strings.EqualFold(level, "trace"):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.log_debug_prod.message")).WithDetail("level", level)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalLogFileOff(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := fileLogging(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !enabled:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.log_file_off.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalMetricsOff(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.MetricsSettings.Enable })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !enabled:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.metrics_off.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
