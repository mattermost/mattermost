// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/internal/probes"
)

func init() {
	healthcheck.Register(ldapProbeFailed, samlProbeFailed, oauthProbeFailed)
}

var ldapProbeFailed = healthcheck.Rule{
	Code:     "LDAP_PROBE_FAILED",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_probe_failed.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_probe_failed.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityProbe,
	AppliesToCloud: true,
	Subject:        "LdapSettings.LdapServer",
	Eval:           ldapRule(ldapEnabled, evalLdapProbeFailed),
}

var samlProbeFailed = healthcheck.Rule{
	Code:     "SAML_PROBE_FAILED",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_probe_failed.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_probe_failed.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityProbe,
	AppliesToCloud: true,
	Subject:        "SamlSettings.IdpCertificateFile",
	Eval:           samlRule(evalSamlProbeFailed),
}

var oauthProbeFailed = healthcheck.Rule{
	Code:     "OAUTH_PROBE_FAILED",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.oauth_probe_failed.title"),
		RemediationID: healthcheck.TranslationId("health.rule.oauth_probe_failed.remediation"),
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityProbe,
	AppliesToCloud: true,
	Eval:           evalOAuthProbeFailed,
}

type oauthProvider struct {
	id      string
	enabled func(*model.Config) *bool
	feature func(*model.Features) *bool
	status  func(*model.OAuthProviders) model.OAuthProviderStatus
}

var oauthProviders = []oauthProvider{
	{
		id:      model.ServiceGitlab,
		enabled: func(cfg *model.Config) *bool { return cfg.GitLabSettings.Enable },
		status:  func(p *model.OAuthProviders) model.OAuthProviderStatus { return p.GitLab },
	},
	{
		id:      model.ServiceGoogle,
		enabled: func(cfg *model.Config) *bool { return cfg.GoogleSettings.Enable },
		feature: healthcheck.FeatureGoogleOAuth,
		status:  func(p *model.OAuthProviders) model.OAuthProviderStatus { return p.Google },
	},
	{
		id:      model.ServiceOffice365,
		enabled: func(cfg *model.Config) *bool { return cfg.Office365Settings.Enable },
		feature: healthcheck.FeatureOffice365OAuth,
		status:  func(p *model.OAuthProviders) model.OAuthProviderStatus { return p.Office365 },
	},
	{
		id:      model.ServiceOpenid,
		enabled: func(cfg *model.Config) *bool { return cfg.OpenIdSettings.Enable },
		feature: healthcheck.FeatureOpenID,
		status:  func(p *model.OAuthProviders) model.OAuthProviderStatus { return p.OpenID },
	},
}

// An empty or disabled status means the node never ran the probe, so it is left out. Probe
// section errors are ignored: the collector sets them when LDAP vendor info fails after a passing
// test, or when a probe does not finish in time, which leaves its status empty.
func ldapProbe(n *healthcheck.NodeSnapshot) (status, probeErr string) {
	diag, ok := n.Diag()
	if !ok {
		return "", ""
	}

	return diag.LDAP.Status, diag.LDAP.Error
}

func samlProbe(n *healthcheck.NodeSnapshot) (status, probeErr string) {
	diag, ok := n.Diag()
	if !ok {
		return "", ""
	}

	return diag.SAML.Status, diag.SAML.Error
}

func evalLdapProbeFailed(s *healthcheck.Snapshot) healthcheck.Result {
	return probes.Eval(s, ldapProbe,
		healthcheck.TranslationId("health.rule.ldap_probe_failed.message"),
		healthcheck.TranslationId("health.rule.ldap_probe_failed.message.partial"))
}

func evalSamlProbeFailed(s *healthcheck.Snapshot) healthcheck.Result {
	return probes.Eval(s, samlProbe,
		healthcheck.TranslationId("health.rule.saml_probe_failed.message"),
		healthcheck.TranslationId("health.rule.saml_probe_failed.message.partial"))
}

func evalOAuthProbeFailed(s *healthcheck.Snapshot) []healthcheck.Result {
	results := make([]healthcheck.Result, 0, len(oauthProviders))
	for _, provider := range oauthProviders {
		enabled, ok := s.ConfigBool(provider.enabled)
		switch {
		case !ok:
			results = append(results, healthcheck.UnknownSubject(provider.id, healthcheck.ReasonConfigUnavailable))
			continue
		case !enabled:
			results = append(results, healthcheck.ResolvedSubject(provider.id))
			continue
		}

		result := probes.Eval(s, func(n *healthcheck.NodeSnapshot) (string, string) {
			diag, ok := n.SectionDiag(model.SectionOAuthProbes)
			if !ok {
				return "", ""
			}

			status := provider.status(&diag.OAuthProviders)
			if status.Status == model.StatusDisabled {
				return model.StatusOk, ""
			}
			return status.Status, probes.MaskURLCredentials(status.Error)
		},
			healthcheck.TranslationId("health.rule.oauth_probe_failed.message"),
			healthcheck.TranslationId("health.rule.oauth_probe_failed.message.partial"))
		result.Subject = provider.id

		if provider.feature != nil && result.State != healthcheck.StateResolved {
			allowed, licenseKnown := s.LicenseAllows(provider.feature)
			switch {
			case !licenseKnown:
				result = healthcheck.UnknownSubject(provider.id, healthcheck.ReasonLicenseUnavailable)
			case !allowed:
				result = healthcheck.ResolvedSubject(provider.id)
			}
		}

		results = append(results, result)
	}

	return results
}
