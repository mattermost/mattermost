// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// probeSnapshot enables LDAP sign-in and SAML over the given nodes.
func probeSnapshot(nodes []*healthcheck.NodeSnapshot, edit func(cfg *model.Config)) *healthcheck.Snapshot {
	s := healthcheck.NewSnapshot(nodes)
	cs := configSnapshot(func(cfg *model.Config) {
		cfg.LdapSettings.Enable = new(true)
		cfg.SamlSettings.Enable = new(true)
		if edit != nil {
			edit(cfg)
		}
	})
	s.Config, s.Sections = cs.Config, cs.Sections
	return s
}

func leaderWith(status, probeErr string) []*healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.LDAP.Status = status
	diag.LDAP.Error = probeErr
	diag.SAML.Status = status
	diag.SAML.Error = probeErr

	return []*healthcheck.NodeSnapshot{
		{Hostname: "app-1.example.com"},
		{Hostname: "app-2.example.com", IsLeader: true, Diagnostics: &model.NodeDiagnostics{Diagnostics: diag}},
	}
}

func TestProbeRules(t *testing.T) {
	t.Parallel()

	diagnosticsUnavailable := want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
	details := map[string]string{"error": "connection refused"}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "fail",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "connection refused"), nil),
			want: map[string]want{
				"LDAP_PROBE_FAILED": firing("health.rule.ldap_probe_failed.message", details),
				"SAML_PROBE_FAILED": firing("health.rule.saml_probe_failed.message", details),
			},
		},
		{
			name:     "ok",
			snapshot: probeSnapshot(leaderWith(model.StatusOk, ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_PROBE_FAILED": resolved},
		},
		{
			name:     "disabled",
			snapshot: probeSnapshot(leaderWith(model.StatusDisabled, ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_PROBE_FAILED": resolved},
		},
		{
			name:     "empty status",
			snapshot: probeSnapshot(leaderWith("", ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_PROBE_FAILED": diagnosticsUnavailable},
		},
		{
			name:     "leader without diagnostics",
			snapshot: probeSnapshot([]*healthcheck.NodeSnapshot{{Hostname: "app-1.example.com", IsLeader: true}}, nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_PROBE_FAILED": diagnosticsUnavailable},
		},
		{
			name:     "no leader",
			snapshot: probeSnapshot(nil, nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_PROBE_FAILED": diagnosticsUnavailable},
		},
		{
			name:     "expired IdP certificate",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "SAML IdP certificate expired on 2026-01-01T00:00:00Z"), nil),
			want: map[string]want{
				"SAML_PROBE_FAILED": firing("health.rule.saml_probe_failed.message", map[string]string{"error": "SAML IdP certificate expired on 2026-01-01T00:00:00Z"}),
			},
		},
		{
			name:     "SAML enable absent",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, ""), func(cfg *model.Config) { cfg.SamlSettings.Enable = nil }),
			want:     map[string]want{"SAML_PROBE_FAILED": configUnavailable},
		},
		{
			name: "both disabled with failing probes",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "connection refused"), func(cfg *model.Config) {
				cfg.LdapSettings.Enable = new(false)
				cfg.SamlSettings.Enable = new(false)
			}),
			want: map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_PROBE_FAILED": resolved},
		},
		{
			name: "LDAP sync only probes LDAP",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "connection refused"), func(cfg *model.Config) {
				cfg.LdapSettings.Enable = new(false)
				cfg.LdapSettings.EnableSync = new(true)
			}),
			want: map[string]want{"LDAP_PROBE_FAILED": firing("health.rule.ldap_probe_failed.message", details)},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, tc.want)
		})
	}
}
