// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(developerModeOn)
}

var developerModeOn = healthcheck.Rule{
	Code:     "DEVELOPER_MODE_ON",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.developer_mode_on.title"),
		RemediationID: healthcheck.TranslationId("health.rule.developer_mode_on.remediation"),
		ConsolePath:   "/admin_console/environment/developer",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalDeveloperModeOn,
}

var developerSettings = []struct {
	subject   string
	messageID string
	setting   func(*model.Config) *bool
}{
	{
		subject:   "ServiceSettings.EnableDeveloper",
		messageID: healthcheck.TranslationId("health.rule.developer_mode_on.message.enable_developer"),
		setting:   func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableDeveloper },
	},
	{
		subject:   "ServiceSettings.EnableTesting",
		messageID: healthcheck.TranslationId("health.rule.developer_mode_on.message.enable_testing"),
		setting:   func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableTesting },
	},
}

// evalDeveloperModeOn yields one result per setting so muting one does not hide the other.
func evalDeveloperModeOn(s *healthcheck.Snapshot) []healthcheck.Result {
	results := make([]healthcheck.Result, 0, len(developerSettings))
	for _, ds := range developerSettings {
		enabled, ok := s.ConfigBool(ds.setting)
		switch {
		case !ok:
			results = append(results, healthcheck.UnknownSubject(ds.subject, healthcheck.ReasonConfigUnavailable))
		case enabled:
			results = append(results, healthcheck.FiringSubject(ds.subject, ds.messageID))
		default:
			results = append(results, healthcheck.ResolvedSubject(ds.subject))
		}
	}
	return results
}
