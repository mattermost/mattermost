// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(sessionExtendOff)
}

// Only upgraded configs default this to false, so the rule mostly finds long-lived installs.
var sessionExtendOff = healthcheck.Rule{
	Code:     "SESSION_EXTEND_OFF",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.session_extend_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.session_extend_off.remediation"),
		DocsURL:       "https://mattermost.com/pl/configure-session-lengths",
		ConsolePath:   "/admin_console/environment/session_lengths",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ServiceSettings.ExtendSessionLengthWithActivity",
	Eval:       evalSessionExtendOff,
}

func evalSessionExtendOff(s *healthcheck.Snapshot) []healthcheck.Result {
	extend, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.ExtendSessionLengthWithActivity })
	switch {
	case !ok:
		return []healthcheck.Result{unknownConfig()}
	case !extend:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.session_extend_off.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
