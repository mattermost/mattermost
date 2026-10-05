// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package compliance

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const auditLogOffMinUsers = 5000

var auditLogOff = healthcheck.Rule{
	Code:     "AUDIT_LOG_OFF",
	Area:     model.AreaCompliance,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.audit_log_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.audit_log_off.remediation"),
		ConsolePath:   "/admin_console/compliance/audit_logging",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "ExperimentalAuditSettings.FileEnabled",
	Eval:       evalAuditLogOff,
}

func evalAuditLogOff(s *healthcheck.Snapshot) []healthcheck.Result {
	if _, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ExperimentalAuditSettings.FileEnabled }); !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if config.IsAuditLoggingActive(s.Config.Config.ExperimentalAuditSettings, allowAdvancedLogging(s)) {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	users, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
	case users > auditLogOffMinUsers:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.audit_log_off.message")).
			WithDetail("users", strconv.FormatInt(users, 10)).
			WithValue(float64(users))}
	default:
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(users))}
	}
}

// Offline packets carry no license, so a nil license cannot rule out advanced audit targets.
func allowAdvancedLogging(s *healthcheck.Snapshot) bool {
	if s.License == nil {
		return true
	}
	allowed, _ := s.LicenseFeature(func(f *model.Features) *bool { return f.AdvancedLogging })
	return allowed
}
