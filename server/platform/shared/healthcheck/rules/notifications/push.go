// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifications

import (
	"net/url"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(pushEmptyURL, pushBadScheme, pushTestProxy)
}

// The codes share a Subject so a mute on one condition never hides another.
const (
	pushSubject     = "EmailSettings.PushNotificationServer"
	pushConsolePath = "/admin_console/environment/push_notification_server"
	pushDocsURL     = "https://mattermost.com/pl/setup-push-notifications"
)

var pushEmptyURL = healthcheck.Rule{
	Code:     "PUSH_EMPTY_URL",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.push_empty_url.title"),
		RemediationID: healthcheck.TranslationId("health.rule.push_empty_url.remediation"),
		DocsURL:       pushDocsURL,
		ConsolePath:   pushConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        pushSubject,
	Eval:           evalPushEmptyURL,
}

var pushBadScheme = healthcheck.Rule{
	Code:     "PUSH_BAD_SCHEME",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.push_bad_scheme.title"),
		RemediationID: healthcheck.TranslationId("health.rule.push_bad_scheme.remediation"),
		DocsURL:       pushDocsURL,
		ConsolePath:   pushConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        pushSubject,
	Eval:           evalPushBadScheme,
}

var pushTestProxy = healthcheck.Rule{
	Code:     "PUSH_TEST_PROXY",
	Area:     model.AreaNotifications,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.push_test_proxy.title"),
		RemediationID: healthcheck.TranslationId("health.rule.push_test_proxy.remediation"),
		DocsURL:       pushDocsURL,
		ConsolePath:   pushConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        pushSubject,
	Eval:           evalPushTestProxy,
}

// pushServer returns the configured push server, with enabled=false when push is off.
func pushServer(s *healthcheck.Snapshot) (server string, enabled, ok bool) {
	enabled, ok = s.ConfigBool(func(cfg *model.Config) *bool { return cfg.EmailSettings.SendPushNotifications })
	if !ok || !enabled {
		return "", enabled, ok
	}

	server, ok = s.ConfigString(func(cfg *model.Config) *string { return cfg.EmailSettings.PushNotificationServer })
	return server, true, ok
}

func hasScheme(server, scheme string) bool {
	return strings.HasPrefix(strings.ToLower(server), scheme)
}

func isTestProxy(server string) bool {
	u, err := url.Parse(server)
	return err == nil && u.Scheme == "https" && strings.EqualFold(u.Hostname(), "push-test.mattermost.com")
}

func evalPushEmptyURL(s *healthcheck.Snapshot) []healthcheck.Result {
	server, enabled, ok := pushServer(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case enabled && server == "":
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_empty_url.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalPushBadScheme(s *healthcheck.Snapshot) []healthcheck.Result {
	server, enabled, ok := pushServer(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !enabled || server == "" || hasScheme(server, "https://"):
		return []healthcheck.Result{healthcheck.Resolved()}
	case hasScheme(server, "http://"):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_bad_scheme.message.http")).WithDetail("url", server)}
	default:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_bad_scheme.message.missing")).WithDetail("url", server)}
	}
}

func evalPushTestProxy(s *healthcheck.Snapshot) []healthcheck.Result {
	server, enabled, ok := pushServer(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case enabled && isTestProxy(server):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_test_proxy.message")).WithDetail("url", server)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
