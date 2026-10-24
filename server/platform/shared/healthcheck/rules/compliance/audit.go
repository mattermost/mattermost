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
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.audit_log_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.audit_log_off.remediation"),
		ConsolePath:   "/admin_console/compliance/audit_logging",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "ExperimentalAuditSettings.FileEnabled",
	Eval:       healthcheck.Single(evalAuditLogOff),
}

func evalAuditLogOff(s *healthcheck.Snapshot) healthcheck.Result {
	license, ok := s.License()
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonLicenseUnavailable)
	}
	// Matches the System Console, which hides the Audit Logging page below Enterprise.
	if !license.MinimumEnterprise() {
		return healthcheck.Resolved()
	}

	if _, ok = s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ExperimentalAuditSettings.FileEnabled }); !ok {
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	}
	if auditLoggingActive(s) {
		return healthcheck.Resolved()
	}

	users, ok := s.RegisteredUsers()
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)
	case users > auditLogOffMinUsers:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.audit_log_off.message")).
			WithDetail("users", strconv.FormatInt(users, 10)).
			WithValue(float64(users))
	default:
		return healthcheck.Resolved().WithValue(float64(users))
	}
}

// Prefers the server's recorded result: checking the config here would use the environment and
// platform of whatever machine evaluates a packet. Packets from older servers fall back to the config.
func auditLoggingActive(s *healthcheck.Snapshot) bool {
	if diag, ok := s.LeaderDiag(model.SectionConfigSource); ok && diag.Config.AuditLoggingActive != nil {
		return *diag.Config.AuditLoggingActive
	}
	return config.IsAuditLoggingActive(s.Config.Config.ExperimentalAuditSettings, allowAdvancedLogging(s))
}

// An unknown license, as in packets from older servers, cannot rule out advanced audit targets.
func allowAdvancedLogging(s *healthcheck.Snapshot) bool {
	allowed, ok := s.LicenseFeature(func(f *model.Features) *bool { return f.AdvancedLogging })
	return !ok || allowed
}
