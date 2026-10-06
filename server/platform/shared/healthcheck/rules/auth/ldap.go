// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"slices"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(
		ldapPortTLSMismatch,
		ldapPortPlainMismatch,
		ldapSkipCert,
		ldapQueryTimeoutLow,
		ldapSyncIntervalLow,
		ldapSyncNoBaseDN,
		ldapRecommendedAtScale,
		ldapIDIsEmail,
		ldapSyncDutyCycle,
	)
}

const (
	ldapPortSubject         = "LdapSettings.LdapPort"
	ldapSyncIntervalSubject = "LdapSettings.SyncIntervalMinutes"

	minLdapQueryTimeoutSeconds  = 10
	minLdapSyncIntervalMinutes  = 10
	ldapRecommendedUsers        = 100
	maxDutyCycleIntervalMinutes = 30
	maxDutyCyclePct             = 25
)

var ldapIDEmailAttributes = []string{"mail", "email", "userprincipalname"}

var ldapPortTLSMismatch = healthcheck.Rule{
	Code:     "LDAP_PORT_TLS_MISMATCH",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_port_tls_mismatch.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_port_tls_mismatch.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        ldapPortSubject,
	Eval:           gated(ldapEnabled, evalLdapPortTLSMismatch),
}

var ldapPortPlainMismatch = healthcheck.Rule{
	Code:     "LDAP_PORT_PLAIN_MISMATCH",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_port_plain_mismatch.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_port_plain_mismatch.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        ldapPortSubject,
	Eval:           gated(ldapEnabled, evalLdapPortPlainMismatch),
}

var ldapSkipCert = healthcheck.Rule{
	Code:     "LDAP_SKIP_CERT",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_skip_cert.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_skip_cert.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        "LdapSettings.SkipCertificateVerification",
	Eval:           gated(ldapEnabled, evalLdapSkipCert),
}

var ldapQueryTimeoutLow = healthcheck.Rule{
	Code:     "LDAP_QUERY_TIMEOUT_LOW",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_query_timeout_low.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_query_timeout_low.remediation"),
		DocsURL:       "https://mattermost.com/pl/configure-ad-ldap-query-timeout",
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        "LdapSettings.QueryTimeout",
	Eval:           gated(ldapEnabled, evalLdapQueryTimeoutLow),
}

var ldapSyncIntervalLow = healthcheck.Rule{
	Code:     "LDAP_SYNC_INTERVAL_LOW",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_sync_interval_low.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_sync_interval_low.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        ldapSyncIntervalSubject,
	Eval:           gated(ldapSyncEnabled, evalLdapSyncIntervalLow),
}

var ldapSyncNoBaseDN = healthcheck.Rule{
	Code:     "LDAP_SYNC_NO_BASEDN",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_sync_no_basedn.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_sync_no_basedn.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        "LdapSettings.BaseDN",
	Eval:           gated(ldapSyncEnabled, evalLdapSyncNoBaseDN),
}

var ldapRecommendedAtScale = healthcheck.Rule{
	Code:     "LDAP_RECOMMENDED_AT_SCALE",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_recommended_at_scale.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_recommended_at_scale.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityThreshold,
	AppliesToCloud: true,
	Subject:        "LdapSettings.Enable",
	Eval:           evalLdapRecommendedAtScale,
}

var ldapIDIsEmail = healthcheck.Rule{
	Code:     "LDAP_ID_IS_EMAIL",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_id_is_email.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_id_is_email.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityStable,
	AppliesToCloud: true,
	Subject:        "LdapSettings.IdAttribute",
	Eval:           gated(ldapEnabled, evalLdapIDIsEmail),
}

var ldapSyncDutyCycle = healthcheck.Rule{
	Code:     "LDAP_SYNC_DUTY_CYCLE",
	Area:     model.AreaAuth,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ldap_sync_duty_cycle.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ldap_sync_duty_cycle.remediation"),
		DocsURL:       ldapDocsURL,
		ConsolePath:   ldapConsolePath,
	},
	Surface:        healthcheck.SurfaceProduct,
	Volatility:     healthcheck.VolatilityThreshold,
	AppliesToCloud: true,
	Subject:        ldapSyncIntervalSubject,
	Eval:           gated(ldapSyncEnabled, evalLdapSyncDutyCycle),
}

func ldapPortSecurity(s *healthcheck.Snapshot) (port int, security string, ok bool) {
	port, ok = s.ConfigInt(func(cfg *model.Config) *int { return cfg.LdapSettings.LdapPort })
	if !ok {
		return 0, "", false
	}

	security, ok = s.ConfigString(func(cfg *model.Config) *string { return cfg.LdapSettings.ConnectionSecurity })
	return port, security, ok
}

func evalLdapPortTLSMismatch(s *healthcheck.Snapshot) healthcheck.Result {
	port, security, ok := ldapPortSecurity(s)
	switch {
	case !ok:
		return unknownConfig()
	case port == 389 && security == model.ConnSecurityTLS:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_port_tls_mismatch.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalLdapPortPlainMismatch(s *healthcheck.Snapshot) healthcheck.Result {
	port, security, ok := ldapPortSecurity(s)
	switch {
	case !ok:
		return unknownConfig()
	case port == 636 && (security == model.ConnSecurityNone || security == model.ConnSecurityStarttls):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_port_plain_mismatch.message"))
	default:
		return healthcheck.Resolved()
	}
}

// SkipCertificateVerification is inert without TLS or STARTTLS.
func evalLdapSkipCert(s *healthcheck.Snapshot) healthcheck.Result {
	security, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.LdapSettings.ConnectionSecurity })
	if !ok {
		return unknownConfig()
	}

	skip, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LdapSettings.SkipCertificateVerification })
	switch {
	case !ok:
		return unknownConfig()
	case skip && security != model.ConnSecurityNone:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_skip_cert.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalLdapQueryTimeoutLow(s *healthcheck.Snapshot) healthcheck.Result {
	timeout, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.LdapSettings.QueryTimeout })
	switch {
	case !ok:
		return unknownConfig()
	case timeout < minLdapQueryTimeoutSeconds:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_query_timeout_low.message")).WithDetail("timeout", strconv.Itoa(timeout))
	default:
		return healthcheck.Resolved()
	}
}

func evalLdapSyncIntervalLow(s *healthcheck.Snapshot) healthcheck.Result {
	interval, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.LdapSettings.SyncIntervalMinutes })
	switch {
	case !ok:
		return unknownConfig()
	case interval < minLdapSyncIntervalMinutes:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_sync_interval_low.message")).WithDetail("interval", strconv.Itoa(interval))
	default:
		return healthcheck.Resolved()
	}
}

// Validation requires BaseDN when Enable is set, so this can only fire on a sync-only install.
func evalLdapSyncNoBaseDN(s *healthcheck.Snapshot) healthcheck.Result {
	baseDN, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.LdapSettings.BaseDN })
	switch {
	case !ok:
		return unknownConfig()
	case baseDN == "":
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_sync_no_basedn.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalLdapIDIsEmail(s *healthcheck.Snapshot) healthcheck.Result {
	attribute, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.LdapSettings.IdAttribute })
	switch {
	case !ok:
		return unknownConfig()
	case slices.Contains(ldapIDEmailAttributes, strings.ToLower(attribute)):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_id_is_email.message")).WithDetail("attribute", attribute)
	default:
		return healthcheck.Resolved()
	}
}

// Identity gates come before stats so a packet without stats still resolves an LDAP or SAML install.
func evalLdapRecommendedAtScale(s *healthcheck.Snapshot) []healthcheck.Result {
	ldap, ok := ldapEnabled(s)
	if !ok {
		return []healthcheck.Result{unknownConfig()}
	}
	saml, ok := samlEnabled(s)
	if !ok {
		return []healthcheck.Result{unknownConfig()}
	}
	if ldap || saml {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	users, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
	}

	result := healthcheck.Resolved()
	if users > ldapRecommendedUsers {
		result = healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_recommended_at_scale.message")).WithDetail("users", strconv.FormatInt(users, 10))
	}
	return []healthcheck.Result{result.WithValue(float64(users))}
}

func evalLdapSyncDutyCycle(s *healthcheck.Snapshot) healthcheck.Result {
	interval, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.LdapSettings.SyncIntervalMinutes })
	switch {
	case !ok:
		return unknownConfig()
	case interval <= 0 || interval > maxDutyCycleIntervalMinutes:
		return healthcheck.Resolved()
	}

	jobs, ok := s.JobsFor(model.JobTypeLdapSync)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonJobsUnavailable)
	}

	var totalMillis, runs int64
	for _, job := range jobs {
		// A job that never started has no duration, only a creation time.
		if job == nil || job.StartAt <= 0 || job.LastActivityAt <= job.StartAt {
			continue
		}
		totalMillis += job.LastActivityAt - job.StartAt
		runs++
	}
	if runs == 0 {
		return healthcheck.Unknown(healthcheck.TranslationId("health.rule.ldap_sync_duty_cycle.message.no_runs"))
	}

	avgSeconds := float64(totalMillis) / float64(runs) / 1000
	dutyPct := 100 * avgSeconds / float64(interval*60)

	result := healthcheck.Resolved()
	if dutyPct >= maxDutyCyclePct {
		result = healthcheck.Firing(healthcheck.TranslationId("health.rule.ldap_sync_duty_cycle.message")).
			WithDetail("interval_minutes", strconv.Itoa(interval)).
			WithDetail("avg_run_seconds", strconv.FormatFloat(avgSeconds, 'f', 0, 64)).
			WithDetail("duty_pct", strconv.FormatFloat(dutyPct, 'f', 0, 64))
	}
	return result.WithValue(dutyPct)
}
