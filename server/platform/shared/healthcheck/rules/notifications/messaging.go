// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifications

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(pushIDOnly, linkPreviewsDisabled, maxNotificationsPerChannel, typingMessagesAtScale, smtpUnreachable)
}

const (
	maxNotificationsPerChannelLimit = 5000
	typingMessagesUserLimit         = 5000

	notificationsConsolePath = "/admin_console/environment/notifications"
	postsConsolePath         = "/admin_console/site_config/posts"
	smtpConsolePath          = "/admin_console/environment/smtp"
)

var pushIDOnly = healthcheck.Rule{
	Code:     "PUSH_ID_ONLY",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.push_id_only.title"),
		RemediationID: healthcheck.TranslationId("health.rule.push_id_only.remediation"),
		ConsolePath:   notificationsConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "EmailSettings.PushNotificationContents",
	Eval:       evalPushIDOnly,
}

var linkPreviewsDisabled = healthcheck.Rule{
	Code:     "LINK_PREVIEWS_DISABLED",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.link_previews_disabled.title"),
		RemediationID: healthcheck.TranslationId("health.rule.link_previews_disabled.remediation"),
		ConsolePath:   postsConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ServiceSettings.EnableLinkPreviews",
	Eval:       evalLinkPreviewsDisabled,
}

var maxNotificationsPerChannel = healthcheck.Rule{
	Code:     "MAX_NOTIFICATIONS_PER_CHANNEL",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.max_notifications_per_channel.title"),
		RemediationID: healthcheck.TranslationId("health.rule.max_notifications_per_channel.remediation"),
		ConsolePath:   pushConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "TeamSettings.MaxNotificationsPerChannel",
	Eval:       evalMaxNotificationsPerChannel,
}

var typingMessagesAtScale = healthcheck.Rule{
	Code:     "TYPING_MESSAGES_AT_SCALE",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.typing_messages_at_scale.title"),
		RemediationID: healthcheck.TranslationId("health.rule.typing_messages_at_scale.remediation"),
		ConsolePath:   postsConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "ServiceSettings.EnableUserTypingMessages",
	Eval:       evalTypingMessagesAtScale,
}

var smtpUnreachable = healthcheck.Rule{
	Code:     "SMTP_UNREACHABLE",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.smtp_unreachable.title"),
		RemediationID: healthcheck.TranslationId("health.rule.smtp_unreachable.remediation"),
		ConsolePath:   smtpConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityProbe,
	Subject:    "EmailSettings.SMTPServer",
	Eval:       evalSMTPUnreachable,
}

func evalPushIDOnly(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.EmailSettings.SendPushNotifications })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	contents, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.EmailSettings.PushNotificationContents })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case contents == model.FullNotification:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_id_only.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalLinkPreviewsDisabled(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableLinkPreviews })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !enabled:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.link_previews_disabled.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalMaxNotificationsPerChannel(s *healthcheck.Snapshot) []healthcheck.Result {
	limit, ok := s.ConfigInt64(func(cfg *model.Config) *int64 { return cfg.TeamSettings.MaxNotificationsPerChannel })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case limit > maxNotificationsPerChannelLimit:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.max_notifications_per_channel.message")).WithValue(float64(limit))}
	default:
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(limit))}
	}
}

func evalTypingMessagesAtScale(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableUserTypingMessages })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	users, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.ActiveUsers })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
	case users >= typingMessagesUserLimit:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.typing_messages_at_scale.message")).WithValue(float64(users))}
	default:
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(users))}
	}
}

func evalSMTPUnreachable(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.EmailSettings.SendEmailNotifications })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	notCollected := []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	leader, ok := s.Leader()
	if !ok {
		return notCollected
	}
	diag, ok := leader.Diag()
	if !ok {
		return notCollected
	}
	if _, err := leader.SectionErr(model.SectionSMTPProbe); err != nil {
		return notCollected
	}

	email := diag.Notifications.Email
	switch email.Status {
	case model.StatusOk, model.StatusDisabled:
		return []healthcheck.Result{healthcheck.Resolved()}
	case model.StatusFail:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.smtp_unreachable.message")).WithDetail("error", email.Error)}
	default:
		return notCollected
	}
}
