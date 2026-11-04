// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
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

// leaderProbe resolves only on OK: an empty or disabled status means the leader never ran the probe.
func leaderProbe(s *healthcheck.Snapshot, probe func(*model.SupportPacketDiagnostics) (status, probeErr string), firingID string) healthcheck.Result {
	leader, _ := s.Leader()
	// Probe section errors are ignored: the collector sets them only when LDAP vendor info fails after a passing test.
	diag, ok := leader.Diag()
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	switch status, probeErr := probe(diag); status {
	case model.StatusOk:
		return healthcheck.Resolved()
	case model.StatusFail:
		return healthcheck.Firing(firingID).WithDetail("error", probeErr)
	default:
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
}

func evalLdapProbeFailed(s *healthcheck.Snapshot) healthcheck.Result {
	return leaderProbe(s, func(diag *model.SupportPacketDiagnostics) (string, string) {
		return diag.LDAP.Status, diag.LDAP.Error
	}, healthcheck.TranslationId("health.rule.ldap_probe_failed.message"))
}

func evalSamlProbeFailed(s *healthcheck.Snapshot) healthcheck.Result {
	return leaderProbe(s, func(diag *model.SupportPacketDiagnostics) (string, string) {
		return diag.SAML.Status, diag.SAML.Error
	}, healthcheck.TranslationId("health.rule.saml_probe_failed.message"))
}
