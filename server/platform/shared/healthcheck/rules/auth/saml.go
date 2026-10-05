// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(samlSignatureSHA1, samlVerifyOff, samlEncryptOff, samlIDIsEmail, samlIDMutable)
}

const samlIDSubject = "SamlSettings.IdAttribute"

var (
	// An empty IdAttribute keys SAML accounts by email.
	samlIDEmailAttributes   = []string{"", "email", "mail", "emailaddress"}
	samlIDMutableAttributes = []string{"username", "uid", "samaccountname"}
)

var samlSignatureSHA1 = healthcheck.Rule{
	Code:     "SAML_SIGNATURE_SHA1",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_signature_sha1.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_signature_sha1.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SamlSettings.SignatureAlgorithm",
	Eval:       gated(samlEnabled, evalSamlSignatureSHA1),
}

var samlVerifyOff = healthcheck.Rule{
	Code:     "SAML_VERIFY_OFF",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_verify_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_verify_off.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SamlSettings.Verify",
	Eval:       gated(samlEnabled, evalSamlVerifyOff),
}

var samlEncryptOff = healthcheck.Rule{
	Code:     "SAML_ENCRYPT_OFF",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_encrypt_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_encrypt_off.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SamlSettings.Encrypt",
	Eval:       gated(samlEnabled, evalSamlEncryptOff),
}

var samlIDIsEmail = healthcheck.Rule{
	Code:     "SAML_ID_IS_EMAIL",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_id_is_email.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_id_is_email.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    samlIDSubject,
	Eval:       gated(samlEnabled, evalSamlIDIsEmail),
}

var samlIDMutable = healthcheck.Rule{
	Code:     "SAML_ID_MUTABLE",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.saml_id_mutable.title"),
		RemediationID: healthcheck.TranslationId("health.rule.saml_id_mutable.remediation"),
		DocsURL:       samlDocsURL,
		ConsolePath:   samlConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    samlIDSubject,
	Eval:       gated(samlEnabled, evalSamlIDMutable),
}

// SignatureAlgorithm only signs requests, so it is inert while SignRequest is off.
func evalSamlSignatureSHA1(s *healthcheck.Snapshot) healthcheck.Result {
	sign, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.SamlSettings.SignRequest })
	if !ok {
		return unknownConfig()
	}
	if !sign {
		return healthcheck.Resolved()
	}

	algorithm, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.SamlSettings.SignatureAlgorithm })
	switch {
	case !ok:
		return unknownConfig()
	case algorithm == model.SamlSettingsSignatureAlgorithmSha1:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.saml_signature_sha1.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalSamlVerifyOff(s *healthcheck.Snapshot) healthcheck.Result {
	verify, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.SamlSettings.Verify })
	switch {
	case !ok:
		return unknownConfig()
	case !verify:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.saml_verify_off.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalSamlEncryptOff(s *healthcheck.Snapshot) healthcheck.Result {
	encrypt, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.SamlSettings.Encrypt })
	switch {
	case !ok:
		return unknownConfig()
	case !encrypt:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.saml_encrypt_off.message"))
	default:
		return healthcheck.Resolved()
	}
}

// samlAttributeName reduces a claim URI such as .../identity/claims/emailaddress to its last segment.
func samlAttributeName(attribute string) string {
	return strings.ToLower(attribute[strings.LastIndex(attribute, "/")+1:])
}

func evalSamlIDIsEmail(s *healthcheck.Snapshot) healthcheck.Result {
	attribute, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.SamlSettings.IdAttribute })
	switch {
	case !ok:
		return unknownConfig()
	case slices.Contains(samlIDEmailAttributes, samlAttributeName(attribute)):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.saml_id_is_email.message")).WithDetail("attribute", attribute)
	default:
		return healthcheck.Resolved()
	}
}

func evalSamlIDMutable(s *healthcheck.Snapshot) healthcheck.Result {
	attribute, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.SamlSettings.IdAttribute })
	switch {
	case !ok:
		return unknownConfig()
	case slices.Contains(samlIDMutableAttributes, samlAttributeName(attribute)):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.saml_id_mutable.message")).WithDetail("attribute", attribute)
	default:
		return healthcheck.Resolved()
	}
}
