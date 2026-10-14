// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// probeSnapshot enables LDAP sign-in and SAML with a metadata URL, over the given nodes.
func probeSnapshot(nodes []*healthcheck.NodeSnapshot, edit func(cfg *model.Config)) *healthcheck.Snapshot {
	s := healthcheck.NewSnapshot(nodes)
	s.Config = configSnapshot(func(cfg *model.Config) {
		cfg.LdapSettings.Enable = new(true)
		cfg.SamlSettings.Enable = new(true)
		cfg.SamlSettings.IdpMetadataURL = new("https://idp.example.com/metadata")
		if edit != nil {
			edit(cfg)
		}
	}).Config
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
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
				"LDAP_PROBE_FAILED":         firing("health.rule.ldap_probe_failed.message", details),
				"SAML_METADATA_UNREACHABLE": firing("health.rule.saml_metadata_unreachable.message", details),
			},
		},
		{
			name:     "ok",
			snapshot: probeSnapshot(leaderWith(model.StatusOk, ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_METADATA_UNREACHABLE": resolved},
		},
		{
			name:     "disabled",
			snapshot: probeSnapshot(leaderWith(model.StatusDisabled, ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_METADATA_UNREACHABLE": resolved},
		},
		{
			name:     "empty status",
			snapshot: probeSnapshot(leaderWith("", ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_METADATA_UNREACHABLE": diagnosticsUnavailable},
		},
		{
			name:     "leader without diagnostics",
			snapshot: probeSnapshot([]*healthcheck.NodeSnapshot{{Hostname: "app-1.example.com", IsLeader: true}}, nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_METADATA_UNREACHABLE": diagnosticsUnavailable},
		},
		{
			name:     "no leader",
			snapshot: probeSnapshot(nil, nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_METADATA_UNREACHABLE": diagnosticsUnavailable},
		},
		{
			name:     "empty metadata URL with a failing probe",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "SAML IdP metadata URL is not configured"), func(cfg *model.Config) { cfg.SamlSettings.IdpMetadataURL = new("") }),
			want:     map[string]want{"SAML_METADATA_UNREACHABLE": resolved},
		},
		{
			name:     "metadata URL absent",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, ""), func(cfg *model.Config) { cfg.SamlSettings.IdpMetadataURL = nil }),
			want:     map[string]want{"SAML_METADATA_UNREACHABLE": configUnavailable},
		},
		{
			name: "both disabled with failing probes",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "connection refused"), func(cfg *model.Config) {
				cfg.LdapSettings.Enable = new(false)
				cfg.SamlSettings.Enable = new(false)
			}),
			want: map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_METADATA_UNREACHABLE": resolved},
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
