// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(developerModeOn, testingModeOn)
}

const developerConsolePath = "/admin_console/environment/developer"

var developerModeOn = healthcheck.Rule{
	Code:     "DEVELOPER_MODE_ON",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.developer_mode_on.title"),
		RemediationID: healthcheck.TranslationId("health.rule.developer_mode_on.remediation"),
		ConsolePath:   developerConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ServiceSettings.EnableDeveloper",
	Eval:       healthcheck.Single(evalDeveloperModeOn),
}

var testingModeOn = healthcheck.Rule{
	Code:     "TESTING_MODE_ON",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.testing_mode_on.title"),
		RemediationID: healthcheck.TranslationId("health.rule.testing_mode_on.remediation"),
		ConsolePath:   developerConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ServiceSettings.EnableTesting",
	Eval:       healthcheck.Single(evalTestingModeOn),
}

func evalDeveloperModeOn(s *healthcheck.Snapshot) healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableDeveloper })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case enabled:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.developer_mode_on.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalTestingModeOn(s *healthcheck.Snapshot) healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableTesting })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case enabled:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.testing_mode_on.message"))
	default:
		return healthcheck.Resolved()
	}
}
