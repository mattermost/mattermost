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

// The SAML probe reports a failure whenever IdpMetadataURL is empty, but the URL is
// optional when the IdP certificate is uploaded instead.
func samlMetadataConfigured(s *healthcheck.Snapshot) (bool, bool) {
	enabled, ok := samlEnabled(s)
	if !ok || !enabled {
		return false, ok
	}

	url, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.SamlSettings.IdpMetadataURL })
	return url != "", ok
}

func leaderDiagnostics(s *healthcheck.Snapshot) (*model.SupportPacketDiagnostics, bool) {
	leader, ok := s.Leader()
	if !ok {
		return nil, false
	}

	return leader.Diag()
}

func probeResult(status, probeErr, firingID, unavailableID string) healthcheck.Result {
	switch status {
	case "":
		return healthcheck.Unknown(unavailableID)
	case model.StatusFail:
		return healthcheck.Firing(firingID).WithDetail("error", probeErr)
	default:
		return healthcheck.Resolved()
	}
}

func evalLdapProbeFailed(s *healthcheck.Snapshot) healthcheck.Result {
	unavailableID := healthcheck.TranslationId("health.rule.ldap_probe_failed.message.unavailable")
	diag, ok := leaderDiagnostics(s)
	if !ok {
		return healthcheck.Unknown(unavailableID)
	}

	return probeResult(diag.LDAP.Status, diag.LDAP.Error, healthcheck.TranslationId("health.rule.ldap_probe_failed.message"), unavailableID)
}

func evalSamlMetadataUnreachable(s *healthcheck.Snapshot) healthcheck.Result {
	unavailableID := healthcheck.TranslationId("health.rule.saml_metadata_unreachable.message.unavailable")
	diag, ok := leaderDiagnostics(s)
	if !ok {
		return healthcheck.Unknown(unavailableID)
	}

	return probeResult(diag.SAML.Status, diag.SAML.Error, healthcheck.TranslationId("health.rule.saml_metadata_unreachable.message"), unavailableID)
}
