// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifications

import (
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
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    pushSubject,
	Eval:       evalPushEmptyURL,
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
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    pushSubject,
	Eval:       evalPushBadScheme,
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
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    pushSubject,
	Eval:       evalPushTestProxy,
}

// pushServer returns the configured push server, with enabled=false when push is off.
func pushServer(s *healthcheck.Snapshot) (url string, enabled, ok bool) {
	enabled, ok = s.ConfigBool(func(cfg *model.Config) *bool { return cfg.EmailSettings.SendPushNotifications })
	if !ok || !enabled {
		return "", enabled, ok
	}

	url, ok = s.ConfigString(func(cfg *model.Config) *string { return cfg.EmailSettings.PushNotificationServer })
	return url, true, ok
}

func hasScheme(url, scheme string) bool {
	return strings.HasPrefix(strings.ToLower(url), scheme)
}

func evalPushEmptyURL(s *healthcheck.Snapshot) []healthcheck.Result {
	url, enabled, ok := pushServer(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case enabled && url == "":
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_empty_url.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalPushBadScheme(s *healthcheck.Snapshot) []healthcheck.Result {
	url, enabled, ok := pushServer(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !enabled || url == "" || hasScheme(url, "https://"):
		return []healthcheck.Result{healthcheck.Resolved()}
	case hasScheme(url, "http://"):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_bad_scheme.message.http")).WithDetail("url", url)}
	default:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_bad_scheme.message.missing")).WithDetail("url", url)}
	}
}

func evalPushTestProxy(s *healthcheck.Snapshot) []healthcheck.Result {
	url, enabled, ok := pushServer(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case enabled && hasScheme(url, "https://") && strings.Contains(strings.ToLower(url), "push-test.mattermost.com"):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.push_test_proxy.message")).WithDetail("url", url)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
