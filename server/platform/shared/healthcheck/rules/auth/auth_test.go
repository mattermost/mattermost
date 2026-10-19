// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var allRules = []healthcheck.Rule{
	ldapPortTLSMismatch,
	ldapPortPlainMismatch,
	ldapSkipCert,
	ldapQueryTimeoutLow,
	ldapSyncNoBaseDN,
	ldapRecommendedAtScale,
	ldapIDIsEmail,
	ldapSyncDutyCycle,
	samlSignatureSHA1,
	samlVerifyOff,
	samlEncryptOff,
	samlIDIsEmail,
	samlIDMutable,
	sessionExtendOff,
	ldapProbeFailed,
	samlProbeFailed,
}

type want struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var (
	resolved          = want{state: healthcheck.StateResolved}
	configUnavailable = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
)

func firing(messageID string, details map[string]string) want {
	return want{state: healthcheck.StateFiring, messageID: messageID, details: details}
}

func (w want) withValue(v float64) want {
	w.value = &v
	return w
}

// configSnapshot returns a snapshot over a defaulted config with edit applied.
func configSnapshot(edit func(cfg *model.Config)) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	if edit != nil {
		edit(cfg)
	}

	return &healthcheck.Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
	}
}

func assertResults(t *testing.T, snapshot *healthcheck.Snapshot, wants map[string]want) {
	t.Helper()

	for _, rule := range allRules {
		w, ok := wants[rule.Code]
		if !ok {
			continue
		}

		results := rule.Eval(snapshot)
		require.Len(t, results, 1, rule.Code)
		assert.Equal(t, w.state, results[0].State, rule.Code)
		assert.Equal(t, w.messageID, results[0].MessageID, rule.Code)
		assert.Equal(t, w.details, results[0].Details, rule.Code)
		assert.Equal(t, w.value, results[0].Value, rule.Code)
	}
}

func TestRegistered(t *testing.T) {
	registry := healthcheck.Builtin()
	require.NoError(t, registry.Validate())

	severities := map[string]healthcheck.Severity{
		"LDAP_PORT_TLS_MISMATCH":    healthcheck.SeverityWarning,
		"LDAP_PORT_PLAIN_MISMATCH":  healthcheck.SeverityWarning,
		"LDAP_SKIP_CERT":            healthcheck.SeverityWarning,
		"LDAP_QUERY_TIMEOUT_LOW":    healthcheck.SeverityInfo,
		"LDAP_SYNC_NO_BASEDN":       healthcheck.SeverityCritical,
		"LDAP_RECOMMENDED_AT_SCALE": healthcheck.SeverityInfo,
		"LDAP_ID_IS_EMAIL":          healthcheck.SeverityWarning,
		"LDAP_SYNC_DUTY_CYCLE":      healthcheck.SeverityWarning,
		"SAML_SIGNATURE_SHA1":       healthcheck.SeverityInfo,
		"SAML_VERIFY_OFF":           healthcheck.SeverityCritical,
		"SAML_ENCRYPT_OFF":          healthcheck.SeverityInfo,
		"SAML_ID_IS_EMAIL":          healthcheck.SeverityInfo,
		"SAML_ID_MUTABLE":           healthcheck.SeverityInfo,
		"SESSION_EXTEND_OFF":        healthcheck.SeverityInfo,
		"LDAP_PROBE_FAILED":         healthcheck.SeverityWarning,
		"SAML_PROBE_FAILED":         healthcheck.SeverityWarning,
	}
	require.Len(t, severities, len(allRules))

	for _, rule := range allRules {
		registered, ok := registry.Get(rule.Code)
		require.True(t, ok, rule.Code)
		assert.Equal(t, severities[rule.Code], registered.Severity, rule.Code)
		assert.Equal(t, model.AreaAuth, registered.Area, rule.Code)
		assert.Equal(t, healthcheck.SurfaceProduct, registered.Surface, rule.Code)
		assert.NotNil(t, registered.Eval, rule.Code)
		assert.False(t, registered.IsNodeScoped(), rule.Code)
	}
}

func TestConfigAbsent(t *testing.T) {
	t.Parallel()

	wants := map[string]want{}
	for _, rule := range allRules {
		wants[rule.Code] = configUnavailable
	}

	t.Run("no config section", func(t *testing.T) {
		t.Parallel()
		assertResults(t, &healthcheck.Snapshot{}, wants)
	})

	t.Run("gate settings absent", func(t *testing.T) {
		t.Parallel()
		assertResults(t, configSnapshot(func(cfg *model.Config) {
			cfg.LdapSettings = model.LdapSettings{}
			cfg.SamlSettings = model.SamlSettings{}
			cfg.ServiceSettings.ExtendSessionLengthWithActivity = nil
		}), wants)
	})
}

// everyConditionHolds sets every LDAP and SAML setting to a firing value, with both providers off.
func everyConditionHolds(cfg *model.Config) {
	cfg.LdapSettings.LdapPort = new(389)
	cfg.LdapSettings.ConnectionSecurity = new(model.ConnSecurityTLS)
	cfg.LdapSettings.SkipCertificateVerification = new(true)
	cfg.LdapSettings.QueryTimeout = new(5)
	cfg.LdapSettings.SyncIntervalMinutes = new(5)
	cfg.LdapSettings.BaseDN = new("")
	cfg.LdapSettings.IdAttribute = new("mail")

	cfg.SamlSettings.SignRequest = new(true)
	cfg.SamlSettings.SignatureAlgorithm = new(model.SamlSettingsSignatureAlgorithmSha1)
	cfg.SamlSettings.Verify = new(false)
	cfg.SamlSettings.Encrypt = new(false)
	cfg.SamlSettings.IdAttribute = new("")
}

// gateSnapshot carries saturating ldap_sync jobs and failing probes, so every code fires once its gate opens.
func gateSnapshot(edit func(cfg *model.Config)) *healthcheck.Snapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.LDAP.Status = model.StatusFail
	diag.SAML.Status = model.StatusFail

	s := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{{
		Hostname:    "app-1.example.com",
		IsLeader:    true,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
	}})
	cs := configSnapshot(func(cfg *model.Config) {
		everyConditionHolds(cfg)
		edit(cfg)
	})
	s.Config, s.Sections = cs.Config, cs.Sections
	s.Stats = &model.SupportPacketStats{RegisteredUsers: new(int64(500))}
	s.Jobs = &model.SupportPacketJobList{LDAPSyncJobs: []*model.Job{{Status: model.JobStatusSuccess, StartAt: 1_000_000, LastActivityAt: 1_000_000 + 5*60*1000}}}
	s.Sections[model.SectionStats] = nil
	s.Sections[model.SectionJobs] = nil
	return s
}

func TestGates(t *testing.T) {
	t.Parallel()

	ldapGated := []healthcheck.Rule{ldapPortTLSMismatch, ldapSkipCert, ldapQueryTimeoutLow, ldapIDIsEmail, ldapProbeFailed}
	syncGated := []healthcheck.Rule{ldapSyncNoBaseDN, ldapSyncDutyCycle}
	samlGated := []healthcheck.Rule{samlSignatureSHA1, samlVerifyOff, samlEncryptOff, samlIDIsEmail, samlProbeFailed}

	stateOf := func(t *testing.T, s *healthcheck.Snapshot, rules []healthcheck.Rule) map[string]healthcheck.State {
		t.Helper()

		states := map[string]healthcheck.State{}
		for _, rule := range rules {
			results := rule.Eval(s)
			require.Len(t, results, 1, rule.Code)
			states[rule.Code] = results[0].State
		}
		return states
	}
	all := func(rules []healthcheck.Rule, state healthcheck.State) map[string]healthcheck.State {
		states := map[string]healthcheck.State{}
		for _, rule := range rules {
			states[rule.Code] = state
		}
		return states
	}

	t.Run("every gate closed", func(t *testing.T) {
		t.Parallel()

		s := gateSnapshot(func(cfg *model.Config) {})
		assert.Equal(t, all(ldapGated, healthcheck.StateResolved), stateOf(t, s, ldapGated))
		assert.Equal(t, all(syncGated, healthcheck.StateResolved), stateOf(t, s, syncGated))
		assert.Equal(t, all(samlGated, healthcheck.StateResolved), stateOf(t, s, samlGated))
		assert.Equal(t, healthcheck.StateFiring, ldapRecommendedAtScale.Eval(s)[0].State)
	})

	t.Run("sync only opens the LDAP and sync gates", func(t *testing.T) {
		t.Parallel()

		s := gateSnapshot(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = new(false)
			cfg.LdapSettings.EnableSync = new(true)
		})
		assert.Equal(t, all(ldapGated, healthcheck.StateFiring), stateOf(t, s, ldapGated))
		assert.Equal(t, all(syncGated, healthcheck.StateFiring), stateOf(t, s, syncGated))
		assert.Equal(t, all(samlGated, healthcheck.StateResolved), stateOf(t, s, samlGated))
		assertResults(t, s, map[string]want{
			"LDAP_SYNC_NO_BASEDN": firing("health.rule.ldap_sync_no_basedn.message", nil),
		})
	})

	t.Run("sign-in without sync keeps the sync gate closed despite stale jobs", func(t *testing.T) {
		t.Parallel()

		s := gateSnapshot(func(cfg *model.Config) {
			cfg.LdapSettings.Enable = new(true)
			cfg.LdapSettings.EnableSync = new(false)
		})
		assert.Equal(t, all(ldapGated, healthcheck.StateFiring), stateOf(t, s, ldapGated))
		assert.Equal(t, all(syncGated, healthcheck.StateResolved), stateOf(t, s, syncGated))
	})

	t.Run("SAML opens only the SAML gate", func(t *testing.T) {
		t.Parallel()

		s := gateSnapshot(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = new(true)
		})
		assert.Equal(t, all(ldapGated, healthcheck.StateResolved), stateOf(t, s, ldapGated))
		assert.Equal(t, all(syncGated, healthcheck.StateResolved), stateOf(t, s, syncGated))
		assert.Equal(t, all(samlGated, healthcheck.StateFiring), stateOf(t, s, samlGated))
	})
}
