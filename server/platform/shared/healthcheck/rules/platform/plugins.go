// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"maps"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(pluginsOff, pluginHealthOff, pluginNotRunning)
}

const pluginsConsolePath = "/admin_console/plugins/plugin_management"

var pluginsOff = healthcheck.Rule{
	Code:     "PLUGINS_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.plugins_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.plugins_off.remediation"),
		ConsolePath:   pluginsConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "PluginSettings.Enable",
	Eval:       evalPluginsOff,
}

var pluginHealthOff = healthcheck.Rule{
	Code:     "PLUGIN_HEALTH_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.plugin_health_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.plugin_health_off.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "PluginSettings.EnableHealthCheck",
	Eval:       evalPluginHealthOff,
}

var pluginNotRunning = healthcheck.Rule{
	Code:     "PLUGIN_NOT_RUNNING",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.plugin_not_running.title"),
		RemediationID: healthcheck.TranslationId("health.rule.plugin_not_running.remediation"),
		ConsolePath:   pluginsConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityProbe,
	AppliesToCloud: true,
	Subject:        "PluginSettings.PluginStates",
	Eval:           evalPluginNotRunning,
}

func pluginsEnabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.PluginSettings.Enable })
}

func evalPluginsOff(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := pluginsEnabled(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !enabled:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.plugins_off.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalPluginHealthOff(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := pluginsEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	healthCheck, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.PluginSettings.EnableHealthCheck })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !healthCheck:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.plugin_health_off.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

// The plugin list names a plugin as enabled only while it runs, so a plugin enabled in
// config but listed as disabled failed to start or to stay running.
func evalPluginNotRunning(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := pluginsEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}
	if !s.Has(model.SectionPlugins) {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonPluginsUnavailable)}
	}

	states := s.Config.Config.PluginSettings.PluginStates
	var notRunning []string
	for _, id := range slices.Sorted(maps.Keys(states)) {
		if states[id] == nil || !states[id].Enable {
			continue
		}
		// A plugin in neither list is a leftover state entry for an uninstalled plugin.
		if running, listed := s.PluginEnabled(id); listed && !running {
			notRunning = append(notRunning, id)
		}
	}

	if len(notRunning) == 0 {
		return []healthcheck.Result{healthcheck.Resolved()}
	}
	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.plugin_not_running.message")).WithDetail("plugins", strings.Join(notRunning, ", "))}
}
