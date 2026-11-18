// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func oauthNode(hostname string, statuses map[string]model.OAuthProviderStatus) *healthcheck.NodeSnapshot {
	diag := licensedDiag()
	diag.OAuthProviders = model.OAuthProviders{
		GitLab:    model.OAuthProviderStatus{Status: model.StatusOk},
		Google:    model.OAuthProviderStatus{Status: model.StatusOk},
		Office365: model.OAuthProviderStatus{Status: model.StatusOk},
		OpenID:    model.OAuthProviderStatus{Status: model.StatusOk},
	}
	for provider, status := range statuses {
		switch provider {
		case model.ServiceGitlab:
			diag.OAuthProviders.GitLab = status
		case model.ServiceGoogle:
			diag.OAuthProviders.Google = status
		case model.ServiceOffice365:
			diag.OAuthProviders.Office365 = status
		case model.ServiceOpenid:
			diag.OAuthProviders.OpenID = status
		}
	}

	return &healthcheck.NodeSnapshot{Hostname: hostname, Diagnostics: &model.NodeDiagnostics{Diagnostics: diag}}
}

func oauthSnapshot(nodes []*healthcheck.NodeSnapshot, edit func(*model.Config)) *healthcheck.Snapshot {
	if len(nodes) > 0 {
		nodes[0].IsLeader = true
	}

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.GitLabSettings.Enable = new(true)
	cfg.GoogleSettings.Enable = new(true)
	cfg.Office365Settings.Enable = new(true)
	cfg.OpenIdSettings.Enable = new(true)
	if edit != nil {
		edit(cfg)
	}

	s := healthcheck.NewSnapshot(nodes)
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	return s
}

func oauthResolved() map[string]healthcheck.Result {
	return map[string]healthcheck.Result{
		model.ServiceGitlab:    healthcheck.ResolvedSubject(model.ServiceGitlab),
		model.ServiceGoogle:    healthcheck.ResolvedSubject(model.ServiceGoogle),
		model.ServiceOffice365: healthcheck.ResolvedSubject(model.ServiceOffice365),
		model.ServiceOpenid:    healthcheck.ResolvedSubject(model.ServiceOpenid),
	}
}

func assertOAuthResults(t *testing.T, snapshot *healthcheck.Snapshot, want map[string]healthcheck.Result) {
	t.Helper()

	results := oauthProbeFailed.Eval(snapshot)
	require.Len(t, results, len(oauthProviders))

	got := make(map[string]healthcheck.Result, len(results))
	for _, result := range results {
		require.NotEmpty(t, result.Subject)
		_, duplicate := got[result.Subject]
		require.False(t, duplicate, "duplicate subject %q", result.Subject)
		got[result.Subject] = result
	}
	assert.Equal(t, want, got)
}

func TestOAuthProbeFailed(t *testing.T) {
	t.Parallel()

	ok := model.OAuthProviderStatus{Status: model.StatusOk}
	fail := func(err string) model.OAuthProviderStatus {
		return model.OAuthProviderStatus{Status: model.StatusFail, Error: err}
	}
	nodes := func(provider string, statuses ...model.OAuthProviderStatus) []*healthcheck.NodeSnapshot {
		result := make([]*healthcheck.NodeSnapshot, 0, len(statuses))
		for i, status := range statuses {
			result = append(result, oauthNode(fmt.Sprintf("app-%d.example.com", i+1), map[string]model.OAuthProviderStatus{provider: status}))
		}
		return result
	}

	tests := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		provider string
		want     healthcheck.Result
	}{
		{
			name:     "every node fails",
			snapshot: oauthSnapshot(nodes(model.ServiceGitlab, fail("connection refused"), fail("connection refused")), nil),
			provider: model.ServiceGitlab,
			want: healthcheck.FiringSubject(model.ServiceGitlab, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
				WithDetail("nodes", "app-1.example.com, app-2.example.com").
				WithDetail("error", "connection refused"),
		},
		{
			name:     "one node fails",
			snapshot: oauthSnapshot(nodes(model.ServiceGoogle, ok, fail("timeout"), ok), nil),
			provider: model.ServiceGoogle,
			want: healthcheck.FiringSubject(model.ServiceGoogle, healthcheck.TranslationId("health.rule.oauth_probe_failed.message.partial")).
				WithDetail("nodes", "app-2.example.com").
				WithDetail("error", "timeout"),
		},
		{
			name:     "node errors differ",
			snapshot: oauthSnapshot(nodes(model.ServiceOpenid, fail("refused"), fail("timeout")), nil),
			provider: model.ServiceOpenid,
			want: healthcheck.FiringSubject(model.ServiceOpenid, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
				WithDetail("nodes", "app-1.example.com, app-2.example.com").
				WithDetail("error", "app-1.example.com: refused; app-2.example.com: timeout"),
		},
		{
			name:     "ok",
			snapshot: oauthSnapshot(nodes(model.ServiceGitlab, ok, ok), nil),
			provider: model.ServiceGitlab,
			want:     healthcheck.ResolvedSubject(model.ServiceGitlab),
		},
		{
			name:     "disabled status resolves",
			snapshot: oauthSnapshot(nodes(model.ServiceOffice365, model.OAuthProviderStatus{Status: model.StatusDisabled}), nil),
			provider: model.ServiceOffice365,
			want:     healthcheck.ResolvedSubject(model.ServiceOffice365),
		},
		{
			name:     "missing status is unknown",
			snapshot: oauthSnapshot(nodes(model.ServiceGitlab, model.OAuthProviderStatus{}), nil),
			provider: model.ServiceGitlab,
			want:     healthcheck.UnknownSubject(model.ServiceGitlab, healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name:     "unrecognized status is unknown",
			snapshot: oauthSnapshot(nodes(model.ServiceGitlab, model.OAuthProviderStatus{Status: "future"}), nil),
			provider: model.ServiceGitlab,
			want:     healthcheck.UnknownSubject(model.ServiceGitlab, healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name:     "masked error is retained",
			snapshot: oauthSnapshot(nodes(model.ServiceGoogle, fail(model.FakeSetting)), nil),
			provider: model.ServiceGoogle,
			want: healthcheck.FiringSubject(model.ServiceGoogle, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
				WithDetail("nodes", "app-1.example.com").
				WithDetail("error", model.FakeSetting),
		},
		{
			name:     "URL credentials in an error are masked",
			snapshot: oauthSnapshot(nodes(model.ServiceOpenid, fail("Get https://client:secret@idp.example.com: connection refused")), nil),
			provider: model.ServiceOpenid,
			want: healthcheck.FiringSubject(model.ServiceOpenid, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
				WithDetail("nodes", "app-1.example.com").
				WithDetail("error", "Get https://****@idp.example.com: connection refused"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			want := oauthResolved()
			want[tc.provider] = tc.want
			assertOAuthResults(t, tc.snapshot, want)
		})
	}

	t.Run("failed section is unavailable", func(t *testing.T) {
		t.Parallel()
		node := oauthNode("app-1.example.com", nil)
		node.Diagnostics.Errors = model.SectionErrors{model.SectionOAuthProbes: assert.AnError}
		want := map[string]healthcheck.Result{}
		for _, provider := range oauthProviders {
			want[provider.id] = healthcheck.UnknownSubject(provider.id, healthcheck.ReasonDiagnosticsUnavailable)
		}
		assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, nil), want)
	})
}

func TestOAuthProbeGates(t *testing.T) {
	t.Parallel()

	disableAll := func(cfg *model.Config) {
		cfg.GitLabSettings.Enable = new(false)
		cfg.GoogleSettings.Enable = new(false)
		cfg.Office365Settings.Enable = new(false)
		cfg.OpenIdSettings.Enable = new(false)
	}

	t.Run("disabled providers resolve without diagnostics or license", func(t *testing.T) {
		t.Parallel()
		assertOAuthResults(t, oauthSnapshot(nil, disableAll), oauthResolved())
	})

	t.Run("missing config is unknown", func(t *testing.T) {
		t.Parallel()
		want := map[string]healthcheck.Result{}
		for _, provider := range oauthProviders {
			want[provider.id] = healthcheck.UnknownSubject(provider.id, healthcheck.ReasonConfigUnavailable)
		}
		assertOAuthResults(t, healthcheck.NewSnapshot(nil), want)
	})

	t.Run("missing enable setting is unknown", func(t *testing.T) {
		t.Parallel()
		want := oauthResolved()
		want[model.ServiceGoogle] = healthcheck.UnknownSubject(model.ServiceGoogle, healthcheck.ReasonConfigUnavailable)
		assertOAuthResults(t, oauthSnapshot(nil, func(cfg *model.Config) {
			disableAll(cfg)
			cfg.GoogleSettings.Enable = nil
		}), want)
	})

	t.Run("GitLab does not require a license", func(t *testing.T) {
		t.Parallel()
		node := oauthNode("app-1.example.com", map[string]model.OAuthProviderStatus{
			model.ServiceGitlab: {Status: model.StatusFail, Error: "timeout"},
		})
		node.Diagnostics.Diagnostics.License = model.SupportPacketLicense{}
		want := oauthResolved()
		want[model.ServiceGitlab] = healthcheck.FiringSubject(model.ServiceGitlab, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
			WithDetail("nodes", "app-1.example.com").
			WithDetail("error", "timeout")
		assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
			disableAll(cfg)
			cfg.GitLabSettings.Enable = new(true)
		}), want)
	})

	licensedProviders := []struct {
		id        string
		enable    func(*model.Config)
		unlicense func(*model.Features)
	}{
		{model.ServiceGoogle, func(cfg *model.Config) { cfg.GoogleSettings.Enable = new(true) }, func(f *model.Features) { f.GoogleOAuth = new(false) }},
		{model.ServiceOffice365, func(cfg *model.Config) { cfg.Office365Settings.Enable = new(true) }, func(f *model.Features) { f.Office365OAuth = new(false) }},
		{model.ServiceOpenid, func(cfg *model.Config) { cfg.OpenIdSettings.Enable = new(true) }, func(f *model.Features) { f.OpenId = new(false) }},
	}
	for _, provider := range licensedProviders {
		t.Run(provider.id+" failing probe fires", func(t *testing.T) {
			t.Parallel()
			node := oauthNode("app-1.example.com", map[string]model.OAuthProviderStatus{
				provider.id: {Status: model.StatusFail, Error: "timeout"},
			})
			want := oauthResolved()
			want[provider.id] = healthcheck.FiringSubject(provider.id, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
				WithDetail("nodes", "app-1.example.com").
				WithDetail("error", "timeout")
			assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
				disableAll(cfg)
				provider.enable(cfg)
			}), want)
		})

		t.Run(provider.id+" enabled but unlicensed resolves", func(t *testing.T) {
			t.Parallel()
			node := oauthNode("app-1.example.com", map[string]model.OAuthProviderStatus{
				provider.id: {Status: model.StatusFail, Error: "timeout"},
			})
			provider.unlicense(node.Diagnostics.Diagnostics.License.Features)
			assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
				disableAll(cfg)
				provider.enable(cfg)
			}), oauthResolved())
		})
	}

	t.Run("enabled licensed provider with missing license is unknown", func(t *testing.T) {
		t.Parallel()
		node := oauthNode("app-1.example.com", map[string]model.OAuthProviderStatus{
			model.ServiceOpenid: {Status: model.StatusFail, Error: "timeout"},
		})
		node.Diagnostics.Errors = model.SectionErrors{model.SectionLicense: assert.AnError}
		want := oauthResolved()
		want[model.ServiceOpenid] = healthcheck.UnknownSubject(model.ServiceOpenid, healthcheck.ReasonLicenseUnavailable)
		assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
			disableAll(cfg)
			cfg.OpenIdSettings.Enable = new(true)
		}), want)
	})

	t.Run("successful probe resolves without license data", func(t *testing.T) {
		t.Parallel()
		node := oauthNode("app-1.example.com", nil)
		node.Diagnostics.Errors = model.SectionErrors{model.SectionLicense: assert.AnError}
		assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
			disableAll(cfg)
			cfg.GoogleSettings.Enable = new(true)
		}), oauthResolved())
	})

	t.Run("disabled probe status resolves without license data", func(t *testing.T) {
		t.Parallel()
		node := oauthNode("app-1.example.com", map[string]model.OAuthProviderStatus{
			model.ServiceOffice365: {Status: model.StatusDisabled},
		})
		node.Diagnostics.Errors = model.SectionErrors{model.SectionLicense: assert.AnError}
		assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
			disableAll(cfg)
			cfg.Office365Settings.Enable = new(true)
		}), oauthResolved())
	})

	t.Run("feature absent from an older license remains allowed", func(t *testing.T) {
		t.Parallel()
		node := oauthNode("app-1.example.com", map[string]model.OAuthProviderStatus{
			model.ServiceGoogle: {Status: model.StatusFail, Error: "timeout"},
		})
		node.Diagnostics.Diagnostics.License.Features = &model.Features{}
		want := oauthResolved()
		want[model.ServiceGoogle] = healthcheck.FiringSubject(model.ServiceGoogle, healthcheck.TranslationId("health.rule.oauth_probe_failed.message")).
			WithDetail("nodes", "app-1.example.com").
			WithDetail("error", "timeout")
		assertOAuthResults(t, oauthSnapshot([]*healthcheck.NodeSnapshot{node}, func(cfg *model.Config) {
			disableAll(cfg)
			cfg.GoogleSettings.Enable = new(true)
		}), want)
	})
}
