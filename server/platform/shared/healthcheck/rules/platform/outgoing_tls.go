// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(tlsVerifyOutgoingOff)
}

var tlsVerifyOutgoingOff = healthcheck.Rule{
	Code:     "TLS_VERIFY_OUTGOING_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.tls_verify_outgoing_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.tls_verify_outgoing_off.remediation"),
		ConsolePath:   "/admin_console/environment/web_server",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ServiceSettings.EnableInsecureOutgoingConnections",
	Eval:       healthcheck.Single(evalTLSVerifyOutgoingOff),
}

func evalTLSVerifyOutgoingOff(s *healthcheck.Snapshot) healthcheck.Result {
	insecure, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableInsecureOutgoingConnections })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case insecure:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.tls_verify_outgoing_off.message"))
	default:
		return healthcheck.Resolved()
	}
}
