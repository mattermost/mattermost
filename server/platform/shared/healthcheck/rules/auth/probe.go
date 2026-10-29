// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/internal/probes"
)

func init() {
	healthcheck.Register(ldapProbeFailed, samlProbeFailed)
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

// An empty or disabled status means the node never ran the probe, so it is left out. Probe
// section errors are ignored: the collector sets them only when LDAP vendor info fails after a
// passing test.
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
