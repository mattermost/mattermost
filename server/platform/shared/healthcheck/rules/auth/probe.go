// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(ldapProbeFailed, samlMetadataUnreachable)
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
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityProbe,
	Subject:    "LdapSettings.LdapServer",
	Eval:       gated(ldapEnabled, evalLdapProbeFailed),
}

var samlMetadataUnreachable = healthcheck.Rule{
	Code:     "SAML_METADATA_UNREACHABLE",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_metadata_unreachable.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_metadata_unreachable.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityProbe,
	Subject:    "SamlSettings.IdpMetadataURL",
	Eval:       gated(samlMetadataConfigured, evalSamlMetadataUnreachable),
}

// The SAML probe fails on an empty IdpMetadataURL, which is valid when the IdP certificate is uploaded.
func samlMetadataConfigured(s *healthcheck.Snapshot) (bool, bool) {
	enabled, ok := samlEnabled(s)
	if !ok || !enabled {
		return false, ok
	}

	url, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.SamlSettings.IdpMetadataURL })
	return url != "", ok
}

// leaderProbe reads a probe result the leader recorded; an empty status means it never ran.
func leaderProbe(s *healthcheck.Snapshot, probe func(*model.SupportPacketDiagnostics) (status, probeErr string), firingID string) healthcheck.Result {
	leader, _ := s.Leader()
	diag, ok := leader.Diag()
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	switch status, probeErr := probe(diag); status {
	case "":
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	case model.StatusFail:
		return healthcheck.Firing(firingID).WithDetail("error", probeErr)
	default:
		return healthcheck.Resolved()
	}
}

func evalLdapProbeFailed(s *healthcheck.Snapshot) healthcheck.Result {
	return leaderProbe(s, func(diag *model.SupportPacketDiagnostics) (string, string) {
		return diag.LDAP.Status, diag.LDAP.Error
	}, healthcheck.TranslationId("health.rule.ldap_probe_failed.message"))
}

func evalSamlMetadataUnreachable(s *healthcheck.Snapshot) healthcheck.Result {
	return leaderProbe(s, func(diag *model.SupportPacketDiagnostics) (string, string) {
		return diag.SAML.Status, diag.SAML.Error
	}, healthcheck.TranslationId("health.rule.saml_metadata_unreachable.message"))
}
