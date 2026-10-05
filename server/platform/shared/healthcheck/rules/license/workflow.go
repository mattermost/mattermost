// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	workflowSubject     = "plugins.enabled"
	workflowConsolePath = "/admin_console/plugins/plugin_management"
)

var workflowChatOnly = healthcheck.Rule{
	Code:     "WORKFLOW_USAGE_CHAT_ONLY",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.workflow_usage_chat_only.title"),
		RemediationID: healthcheck.TranslationId("health.rule.workflow_usage_chat_only.remediation"),
		ConsolePath:   workflowConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    workflowSubject,
	Eval:       evalWorkflowChatOnly,
}

var workflowLight = healthcheck.Rule{
	Code:     "WORKFLOW_USAGE_LIGHT",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.workflow_usage_light.title"),
		RemediationID: healthcheck.TranslationId("health.rule.workflow_usage_light.remediation"),
		ConsolePath:   workflowConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    workflowSubject,
	Eval:       evalWorkflowLight,
}

type workflowUsage struct {
	plugins  int
	webhooks int64
	bots     int64
}

func (u workflowUsage) chatOnly() bool {
	return u.plugins <= 1 && u.webhooks < 10 && u.bots < 5
}

func (u workflowUsage) light() bool {
	return !u.chatOnly() && u.plugins <= 2 && u.webhooks < 50
}

func (u workflowUsage) firing(messageID string) healthcheck.Result {
	return healthcheck.Firing(messageID).
		WithDetail("plugins", strconv.Itoa(u.plugins)).
		WithDetail("webhooks", strconv.FormatInt(u.webhooks, 10)).
		WithDetail("bots", strconv.FormatInt(u.bots, 10))
}

func readWorkflowUsage(s *healthcheck.Snapshot) (usage workflowUsage, reasonID string) {
	if !s.Has(model.SectionPlugins) || s.Plugins == nil {
		return workflowUsage{}, healthcheck.ReasonPluginsUnavailable
	}
	webhooks, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.IncomingWebhooks })
	if !ok {
		return workflowUsage{}, healthcheck.ReasonStatsUnavailable
	}
	bots, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.BotAccounts })
	if !ok {
		return workflowUsage{}, healthcheck.ReasonStatsUnavailable
	}

	return workflowUsage{plugins: len(s.Plugins.Enabled), webhooks: webhooks, bots: bots}, ""
}

func evalWorkflowChatOnly(s *healthcheck.Snapshot) []healthcheck.Result {
	usage, reasonID := readWorkflowUsage(s)
	switch {
	case reasonID != "":
		return []healthcheck.Result{healthcheck.Unknown(reasonID)}
	case usage.chatOnly():
		return []healthcheck.Result{usage.firing(healthcheck.TranslationId("health.rule.workflow_usage_chat_only.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalWorkflowLight(s *healthcheck.Snapshot) []healthcheck.Result {
	usage, reasonID := readWorkflowUsage(s)
	switch {
	case reasonID != "":
		return []healthcheck.Result{healthcheck.Unknown(reasonID)}
	case usage.light():
		return []healthcheck.Result{usage.firing(healthcheck.TranslationId("health.rule.workflow_usage_light.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
