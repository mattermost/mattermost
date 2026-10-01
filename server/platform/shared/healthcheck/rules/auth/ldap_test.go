// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func ldapSnapshot(edit func(cfg *model.Config)) *healthcheck.Snapshot {
	return configSnapshot(func(cfg *model.Config) {
		cfg.LdapSettings.Enable = new(true)
		cfg.LdapSettings.EnableSync = new(true)
		cfg.LdapSettings.BaseDN = new("dc=example,dc=com")
		cfg.LdapSettings.IdAttribute = new("objectGUID")
		edit(cfg)
	})
}

func TestLdapPortRules(t *testing.T) {
	t.Parallel()

	port := func(port int, security string) *healthcheck.Snapshot {
		return ldapSnapshot(func(cfg *model.Config) {
			cfg.LdapSettings.LdapPort = new(port)
			cfg.LdapSettings.ConnectionSecurity = new(security)
		})
	}
	tlsMismatch := firing("health.rule.ldap_port_tls_mismatch.message", nil)
	plainMismatch := firing("health.rule.ldap_port_plain_mismatch.message", nil)

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{"389 with TLS", port(389, model.ConnSecurityTLS), map[string]want{"LDAP_PORT_TLS_MISMATCH": tlsMismatch, "LDAP_PORT_PLAIN_MISMATCH": resolved}},
		{"389 with STARTTLS", port(389, model.ConnSecurityStarttls), map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": resolved}},
		{"389 without security", port(389, model.ConnSecurityNone), map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": resolved}},
		{"636 with TLS", port(636, model.ConnSecurityTLS), map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": resolved}},
		{"636 without security", port(636, model.ConnSecurityNone), map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": plainMismatch}},
		{"636 with STARTTLS", port(636, model.ConnSecurityStarttls), map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": plainMismatch}},
		{"nonstandard port with TLS", port(3269, model.ConnSecurityTLS), map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": resolved}},
		{
			name: "LDAP off",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.LdapSettings.LdapPort = new(636)
				cfg.LdapSettings.ConnectionSecurity = new(model.ConnSecurityNone)
			}),
			want: map[string]want{"LDAP_PORT_TLS_MISMATCH": resolved, "LDAP_PORT_PLAIN_MISMATCH": resolved},
		},
		{
			name:     "port absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.LdapPort = nil }),
			want:     map[string]want{"LDAP_PORT_TLS_MISMATCH": configUnavailable, "LDAP_PORT_PLAIN_MISMATCH": configUnavailable},
		},
		{
			name:     "connection security absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.ConnectionSecurity = nil }),
			want:     map[string]want{"LDAP_PORT_TLS_MISMATCH": configUnavailable, "LDAP_PORT_PLAIN_MISMATCH": configUnavailable},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, tc.want)
		})
	}
}

func TestLdapSettingRules(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "defaults",
			snapshot: ldapSnapshot(func(cfg *model.Config) {}),
			want: map[string]want{
				"LDAP_SKIP_CERT":         resolved,
				"LDAP_QUERY_TIMEOUT_LOW": resolved,
				"LDAP_SYNC_INTERVAL_LOW": resolved,
				"LDAP_SYNC_NO_BASEDN":    resolved,
				"LDAP_ID_IS_EMAIL":       resolved,
			},
		},
		{
			name:     "skip certificate verification",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.SkipCertificateVerification = new(true) }),
			want:     map[string]want{"LDAP_SKIP_CERT": firing("health.rule.ldap_skip_cert.message", nil)},
		},
		{
			name:     "skip certificate verification absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.SkipCertificateVerification = nil }),
			want:     map[string]want{"LDAP_SKIP_CERT": configUnavailable},
		},
		{
			name:     "query timeout below 10s",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.QueryTimeout = new(9) }),
			want:     map[string]want{"LDAP_QUERY_TIMEOUT_LOW": firing("health.rule.ldap_query_timeout_low.message", map[string]string{"timeout": "9"})},
		},
		{
			name:     "query timeout at 10s",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.QueryTimeout = new(10) }),
			want:     map[string]want{"LDAP_QUERY_TIMEOUT_LOW": resolved},
		},
		{
			name:     "query timeout absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.QueryTimeout = nil }),
			want:     map[string]want{"LDAP_QUERY_TIMEOUT_LOW": configUnavailable},
		},
		{
			name:     "sync interval below 10 minutes",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.SyncIntervalMinutes = new(9) }),
			want:     map[string]want{"LDAP_SYNC_INTERVAL_LOW": firing("health.rule.ldap_sync_interval_low.message", map[string]string{"interval": "9"})},
		},
		{
			name:     "sync interval at 10 minutes",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.SyncIntervalMinutes = new(10) }),
			want:     map[string]want{"LDAP_SYNC_INTERVAL_LOW": resolved},
		},
		{
			name:     "sync interval absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.SyncIntervalMinutes = nil }),
			want:     map[string]want{"LDAP_SYNC_INTERVAL_LOW": configUnavailable},
		},
		{
			name: "sync only with an empty BaseDN",
			snapshot: ldapSnapshot(func(cfg *model.Config) {
				cfg.LdapSettings.Enable = new(false)
				cfg.LdapSettings.BaseDN = new("")
			}),
			want: map[string]want{"LDAP_SYNC_NO_BASEDN": firing("health.rule.ldap_sync_no_basedn.message", nil)},
		},
		{
			name:     "BaseDN absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.BaseDN = nil }),
			want:     map[string]want{"LDAP_SYNC_NO_BASEDN": configUnavailable},
		},
		{
			name:     "IdAttribute mail",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.IdAttribute = new("mail") }),
			want:     map[string]want{"LDAP_ID_IS_EMAIL": firing("health.rule.ldap_id_is_email.message", map[string]string{"attribute": "mail"})},
		},
		{
			name:     "IdAttribute email in upper case",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.IdAttribute = new("EMAIL") }),
			want:     map[string]want{"LDAP_ID_IS_EMAIL": firing("health.rule.ldap_id_is_email.message", map[string]string{"attribute": "EMAIL"})},
		},
		{
			name:     "IdAttribute userPrincipalName",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.IdAttribute = new("userPrincipalName") }),
			want:     map[string]want{"LDAP_ID_IS_EMAIL": firing("health.rule.ldap_id_is_email.message", map[string]string{"attribute": "userPrincipalName"})},
		},
		{
			name:     "IdAttribute absent",
			snapshot: ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.IdAttribute = nil }),
			want:     map[string]want{"LDAP_ID_IS_EMAIL": configUnavailable},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, tc.want)
		})
	}
}

func TestLdapRecommendedAtScale(t *testing.T) {
	t.Parallel()

	snapshot := func(users *int64, edit func(cfg *model.Config)) *healthcheck.Snapshot {
		s := configSnapshot(edit)
		if users != nil {
			s.Stats = &model.SupportPacketStats{RegisteredUsers: users}
			s.Sections[model.SectionStats] = nil
		}
		return s
	}
	firingAt := func(users string, value float64) want {
		return firing("health.rule.ldap_recommended_at_scale.message", map[string]string{"users": users}).withValue(value)
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"over 100 users without LDAP or SAML", snapshot(new(int64(101)), nil), firingAt("101", 101)},
		{"100 users without LDAP or SAML", snapshot(new(int64(100)), nil), resolved.withValue(100)},
		{"SAML enabled and stats absent", snapshot(nil, func(cfg *model.Config) { cfg.SamlSettings.Enable = new(true) }), resolved},
		{"LDAP sign-in enabled and stats absent", snapshot(nil, func(cfg *model.Config) { cfg.LdapSettings.Enable = new(true) }), resolved},
		{"LDAP sync only and stats absent", snapshot(nil, func(cfg *model.Config) { cfg.LdapSettings.EnableSync = new(true) }), resolved},
		{"neither enabled and stats absent", snapshot(nil, nil), want{state: healthcheck.StateUnknown, messageID: "health.rule.ldap_recommended_at_scale.message.stats_unavailable"}},
		{
			name: "user count query failed",
			snapshot: func() *healthcheck.Snapshot {
				s := snapshot(nil, nil)
				s.Stats = &model.SupportPacketStats{}
				s.Sections[model.SectionStats] = nil
				return s
			}(),
			want: want{state: healthcheck.StateUnknown, messageID: "health.rule.ldap_recommended_at_scale.message.stats_unavailable"},
		},
		{"SAML setting absent", snapshot(new(int64(500)), func(cfg *model.Config) { cfg.SamlSettings.Enable = nil }), configUnavailable},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, map[string]want{"LDAP_RECOMMENDED_AT_SCALE": tc.want})
		})
	}
}

func TestLdapSyncDutyCycle(t *testing.T) {
	t.Parallel()

	const start = int64(1_758_000_000_000)
	run := func(seconds int64) *model.Job {
		return &model.Job{Type: model.JobTypeLdapSync, StartAt: start, LastActivityAt: start + seconds*1000}
	}
	snapshot := func(interval int, jobs []*model.Job) *healthcheck.Snapshot {
		s := ldapSnapshot(func(cfg *model.Config) { cfg.LdapSettings.SyncIntervalMinutes = new(interval) })
		if jobs != nil {
			s.Jobs = &model.SupportPacketJobList{LDAPSyncJobs: jobs}
			s.Sections[model.SectionJobs] = nil
		}
		return s
	}
	firingAt := func(interval, avg, duty string, value float64) want {
		return firing("health.rule.ldap_sync_duty_cycle.message", map[string]string{
			"interval_minutes": interval,
			"avg_run_seconds":  avg,
			"duty_pct":         duty,
		}).withValue(value)
	}
	noRuns := want{state: healthcheck.StateUnknown, messageID: "health.rule.ldap_sync_duty_cycle.message.no_runs"}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"run takes 25% of the interval", snapshot(10, []*model.Job{run(150)}), firingAt("10", "150", "25", 25)},
		{"run takes under 25% of the interval", snapshot(10, []*model.Job{run(120)}), resolved.withValue(20)},
		{"averages the runs", snapshot(10, []*model.Job{run(60), run(240)}), firingAt("10", "150", "25", 25)},
		{"30 minute interval is checked", snapshot(30, []*model.Job{run(900)}), firingAt("30", "900", "50", 50)},
		{"interval over 30 minutes resolves without jobs", snapshot(31, nil), resolved},
		{
			name: "runs without a positive duration are skipped",
			snapshot: snapshot(10, []*model.Job{
				run(0),
				{Type: model.JobTypeLdapSync, Status: model.JobStatusPending, LastActivityAt: start},
				nil,
				run(300),
			}),
			want: firingAt("10", "300", "50", 50),
		},
		{"jobs absent", snapshot(10, nil), want{state: healthcheck.StateUnknown, messageID: "health.rule.ldap_sync_duty_cycle.message.jobs_unavailable"}},
		{"no runs", snapshot(10, []*model.Job{}), noRuns},
		{"only pending runs", snapshot(10, []*model.Job{{Type: model.JobTypeLdapSync, Status: model.JobStatusPending}}), noRuns},
		{
			name: "interval absent",
			snapshot: func() *healthcheck.Snapshot {
				s := snapshot(10, []*model.Job{run(300)})
				s.Config.LdapSettings.SyncIntervalMinutes = nil
				return s
			}(),
			want: configUnavailable,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, map[string]want{"LDAP_SYNC_DUTY_CYCLE": tc.want})
		})
	}
}
