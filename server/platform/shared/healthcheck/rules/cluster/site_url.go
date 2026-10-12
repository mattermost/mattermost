// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(siteURLEmpty, siteURLHTTP)
}

const (
	siteURLSubject     = "ServiceSettings.SiteURL"
	siteURLConsolePath = "/admin_console/environment/web_server"
	siteURLDocsURL     = "https://mattermost.com/pl/configure-site-url"
)

var siteURLEmpty = healthcheck.Rule{
	Code:     "SITE_URL_EMPTY",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.site_url_empty.title"),
		RemediationID: healthcheck.TranslationId("health.rule.site_url_empty.remediation"),
		DocsURL:       siteURLDocsURL,
		ConsolePath:   siteURLConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    siteURLSubject,
	Eval:       evalSiteURLEmpty,
}

var siteURLHTTP = healthcheck.Rule{
	Code:     "SITE_URL_HTTP",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.site_url_http.title"),
		RemediationID: healthcheck.TranslationId("health.rule.site_url_http.remediation"),
		DocsURL:       siteURLDocsURL,
		ConsolePath:   siteURLConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    siteURLSubject,
	Eval:       evalSiteURLHTTP,
}

func siteURL(s *healthcheck.Snapshot) (string, bool) {
	return s.ConfigString(func(cfg *model.Config) *string { return cfg.ServiceSettings.SiteURL })
}

func evalSiteURLEmpty(s *healthcheck.Snapshot) []healthcheck.Result {
	url, ok := siteURL(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case url == "":
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.site_url_empty.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalSiteURLHTTP(s *healthcheck.Snapshot) []healthcheck.Result {
	url, ok := siteURL(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case strings.HasPrefix(strings.ToLower(url), "http://"):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.site_url_http.message")).WithDetail("url", url)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
