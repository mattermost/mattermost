// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package compliance

import (
	"encoding/json"
	"slices"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

// The levels of the basic audit file target; audit-delivery is excluded, as in the server.
var basicAuditLevels = []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI}

// auditLoggingActive mirrors config.IsAuditLoggingActive with allowAdvancedLogging=true.
func auditLoggingActive(a model.ExperimentalAuditSettings) bool {
	if a.FileEnabled != nil && *a.FileEnabled {
		return true
	}

	cfg := make(mlog.LoggerConfiguration)
	if err := json.Unmarshal(a.GetAdvancedLoggingConfig(), &cfg); err != nil {
		return false
	}

	for _, target := range cfg {
		for _, level := range target.Levels {
			if slices.ContainsFunc(basicAuditLevels, func(b mlog.Level) bool { return b.ID == level.ID }) {
				return true
			}
		}
	}

	return false
}

func evalAuditLogOff(s *healthcheck.Snapshot) []healthcheck.Result {
	if _, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ExperimentalAuditSettings.FileEnabled }); !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if auditLoggingActive(s.Config.Config.ExperimentalAuditSettings) {
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
