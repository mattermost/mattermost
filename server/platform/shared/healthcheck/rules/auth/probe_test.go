// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"fmt"
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

// probeNode returns a node whose LDAP and SAML probes report status and probeErr.
func probeNode(hostname, status, probeErr string) *healthcheck.NodeSnapshot {
	diag := licensedDiag()
	diag.LDAP.Status = status
	diag.LDAP.Error = probeErr
	diag.SAML.Status = status
	diag.SAML.Error = probeErr

	return &healthcheck.NodeSnapshot{Hostname: hostname, Diagnostics: &model.NodeDiagnostics{Diagnostics: diag}}
}

func leaderWith(status, probeErr string) []*healthcheck.NodeSnapshot {
	leader := probeNode("app-2.example.com", status, probeErr)
	leader.IsLeader = true
	return []*healthcheck.NodeSnapshot{{Hostname: "app-1.example.com", CollectErr: healthcheck.ErrNodeNoReply}, leader}
}

// threeNodes returns a cluster whose leader is app-1 and whose nodes report the given probe results.
func threeNodes(results ...[2]string) []*healthcheck.NodeSnapshot {
	var nodes []*healthcheck.NodeSnapshot
	for i, result := range results {
		nodes = append(nodes, probeNode(fmt.Sprintf("app-%d.example.com", i+1), result[0], result[1]))
	}
	nodes[0].IsLeader = true
	return nodes
}

func TestProbeRules(t *testing.T) {
	t.Parallel()

	diagnosticsUnavailable := want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
	licenseUnavailable := want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonLicenseUnavailable}
	details := map[string]string{"nodes": "app-2.example.com", "error": "connection refused"}
	passed := [2]string{model.StatusOk, ""}
	refused := [2]string{model.StatusFail, "connection refused"}

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
			name:     "every node fails",
			snapshot: probeSnapshot(threeNodes(refused, refused, refused), nil),
			want: map[string]want{
				"LDAP_PROBE_FAILED": firing("health.rule.ldap_probe_failed.message", map[string]string{"nodes": "app-1.example.com, app-2.example.com, app-3.example.com", "error": "connection refused"}),
				"SAML_PROBE_FAILED": firing("health.rule.saml_probe_failed.message", map[string]string{"nodes": "app-1.example.com, app-2.example.com, app-3.example.com", "error": "connection refused"}),
			},
		},
		{
			name:     "one node of three fails",
			snapshot: probeSnapshot(threeNodes(passed, passed, refused), nil),
			want: map[string]want{
				"LDAP_PROBE_FAILED": firing("health.rule.ldap_probe_failed.message.partial", map[string]string{"nodes": "app-3.example.com", "error": "connection refused"}),
				"SAML_PROBE_FAILED": firing("health.rule.saml_probe_failed.message.partial", map[string]string{"nodes": "app-3.example.com", "error": "connection refused"}),
			},
		},
		{
			name:     "a node that did not run the probe is left out",
			snapshot: probeSnapshot(threeNodes(refused, [2]string{model.StatusDisabled, ""}, refused), nil),
			want: map[string]want{
				"LDAP_PROBE_FAILED": firing("health.rule.ldap_probe_failed.message", map[string]string{"nodes": "app-1.example.com, app-3.example.com", "error": "connection refused"}),
				"SAML_PROBE_FAILED": firing("health.rule.saml_probe_failed.message", map[string]string{"nodes": "app-1.example.com, app-3.example.com", "error": "connection refused"}),
			},
		},
		{
			name:     "no node ran the probe",
			snapshot: probeSnapshot(threeNodes([2]string{"", ""}, [2]string{"", ""}, [2]string{"", ""}), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_PROBE_FAILED": diagnosticsUnavailable},
		},
		{
			name:     "ok",
			snapshot: probeSnapshot(leaderWith(model.StatusOk, ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": resolved, "SAML_PROBE_FAILED": resolved},
		},
		{
			name:     "disabled although the gate is open",
			snapshot: probeSnapshot(leaderWith(model.StatusDisabled, ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_PROBE_FAILED": diagnosticsUnavailable},
		},
		{
			name:     "empty status",
			snapshot: probeSnapshot(leaderWith("", ""), nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": diagnosticsUnavailable, "SAML_PROBE_FAILED": diagnosticsUnavailable},
		},
		// The license is read from the leader's diagnostics, so without them the license gate reports first.
		{
			name:     "leader without diagnostics",
			snapshot: probeSnapshot([]*healthcheck.NodeSnapshot{{Hostname: "app-1.example.com", IsLeader: true}}, nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": licenseUnavailable, "SAML_PROBE_FAILED": licenseUnavailable},
		},
		{
			name:     "no leader",
			snapshot: probeSnapshot(nil, nil),
			want:     map[string]want{"LDAP_PROBE_FAILED": licenseUnavailable, "SAML_PROBE_FAILED": licenseUnavailable},
		},
		{
			name:     "expired IdP certificate",
			snapshot: probeSnapshot(leaderWith(model.StatusFail, "SAML IdP certificate expired on 2026-01-01T00:00:00Z"), nil),
			want: map[string]want{
				"SAML_PROBE_FAILED": firing("health.rule.saml_probe_failed.message", map[string]string{"nodes": "app-2.example.com", "error": "SAML IdP certificate expired on 2026-01-01T00:00:00Z"}),
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
