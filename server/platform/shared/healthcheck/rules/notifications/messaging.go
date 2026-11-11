// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifications

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/internal/probes"
)

func init() {
	healthcheck.Register(pushIDOnly, maxNotificationsPerChannel, smtpUnreachable)
}

const (
	maxNotificationsPerChannelLimit = 5000

	notificationsConsolePath = "/admin_console/environment/notifications"
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
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        "EmailSettings.PushNotificationContents",
	Eval:           healthcheck.Gate(pushEnabled, healthcheck.ReasonConfigUnavailable, evalPushIDOnly),
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
	Eval:       healthcheck.Single(evalMaxNotificationsPerChannel),
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
	Eval:       healthcheck.Gate(smtpInUse, healthcheck.ReasonConfigUnavailable, evalSMTPUnreachable),
}

func evalPushIDOnly(s *healthcheck.Snapshot) healthcheck.Result {
	contents, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.EmailSettings.PushNotificationContents })
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	}
	if contents != model.FullNotification {
		return healthcheck.Resolved()
	}

	// full is the server default, so only flag it when id_loaded is an option for this license.
	idLoaded, ok := s.LicenseFeature(healthcheck.FeatureIDLoaded)
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonLicenseUnavailable)
	case idLoaded:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.push_id_only.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalMaxNotificationsPerChannel(s *healthcheck.Snapshot) healthcheck.Result {
	limit, ok := s.ConfigInt64(func(cfg *model.Config) *int64 { return cfg.TeamSettings.MaxNotificationsPerChannel })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case limit > maxNotificationsPerChannelLimit:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.max_notifications_per_channel.message")).WithDetail("limit", strconv.FormatInt(limit, 10)).WithValue(float64(limit))
	default:
		return healthcheck.Resolved().WithValue(float64(limit))
	}
}

// smtpInUse mirrors the gate the Support Packet uses before probing SMTP.
func smtpInUse(s *healthcheck.Snapshot) (inUse, ok bool) {
	for _, get := range []func(*model.Config) *bool{
		func(cfg *model.Config) *bool { return cfg.EmailSettings.SendEmailNotifications },
		func(cfg *model.Config) *bool { return cfg.EmailSettings.RequireEmailVerification },
		func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableEmailInvitations },
		func(cfg *model.Config) *bool { return cfg.EmailSettings.EnableSignInWithEmail },
		func(cfg *model.Config) *bool { return cfg.EmailSettings.EnableSignInWithUsername },
	} {
		enabled, ok := s.ConfigBool(get)
		if !ok {
			return false, false
		}
		if enabled {
			return true, true
		}
	}
	return false, true
}

func evalSMTPUnreachable(s *healthcheck.Snapshot) healthcheck.Result {
	return probes.Eval(s, smtpProbe,
		healthcheck.TranslationId("health.rule.smtp_unreachable.message"),
		healthcheck.TranslationId("health.rule.smtp_unreachable.message.partial"))
}

// A disabled status means the node does not use SMTP, so it counts as passing.
func smtpProbe(n *healthcheck.NodeSnapshot) (status, probeErr string) {
	diag, ok := n.SectionDiag(model.SectionSMTPProbe)
	if !ok {
		return "", ""
	}

	email := diag.Notifications.Email
	if email.Status == model.StatusDisabled {
		return model.StatusOk, ""
	}
	return email.Status, email.Error
}
