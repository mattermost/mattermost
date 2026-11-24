// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(openSignupUnverified)
}

// RestrictCreationToDomains doesn't suppress the finding: the server only checks the typed
// address's domain, so without verification anyone can sign up under an allowed domain.
var openSignupUnverified = healthcheck.Rule{
	Code:     "OPEN_SIGNUP_UNVERIFIED",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.open_signup_unverified.title"),
		RemediationID: healthcheck.TranslationId("health.rule.open_signup_unverified.remediation"),
		DocsURL:       "https://docs.mattermost.com/administration-guide/configure/authentication-configuration-settings.html#require-email-verification",
		ConsolePath:   "/admin_console/authentication/email",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "EmailSettings.RequireEmailVerification",
	Eval:       healthcheck.Single(evalOpenSignupUnverified),
}

// openSignupSettings are the settings CreateUserFromSignup requires before it accepts an email signup.
var openSignupSettings = []func(*model.Config) *bool{
	func(cfg *model.Config) *bool { return cfg.TeamSettings.EnableUserCreation },
	func(cfg *model.Config) *bool { return cfg.TeamSettings.EnableOpenServer },
	func(cfg *model.Config) *bool { return cfg.EmailSettings.EnableSignUpWithEmail },
}

func evalOpenSignupUnverified(s *healthcheck.Snapshot) healthcheck.Result {
	known := true
	for _, get := range openSignupSettings {
		enabled, ok := s.ConfigBool(get)
		if ok && !enabled {
			return healthcheck.Resolved()
		}
		known = known && ok
	}

	verify, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.EmailSettings.RequireEmailVerification })
	switch {
	case ok && verify:
		return healthcheck.Resolved()
	case !ok || !known:
		return unknownConfig()
	}

	if domains, _ := s.ConfigString(func(cfg *model.Config) *string { return cfg.TeamSettings.RestrictCreationToDomains }); domains != "" {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.open_signup_unverified.message.restricted"))
	}
	return healthcheck.Firing(healthcheck.TranslationId("health.rule.open_signup_unverified.message"))
}
