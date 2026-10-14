// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/mattermost/go-i18n/i18n/bundle"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// Tests in this file are not parallel: they set the license on their server.

func setupHealthDashboard(t *testing.T, flagEnabled bool) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = flagEnabled
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	return th
}

func newHealthFinding(code string, surface healthcheck.Surface) *model.HealthFinding {
	now := model.GetMillis()
	return &model.HealthFinding{
		Fingerprint: healthcheck.Fingerprint(code, "ServiceSettings.SiteURL", ""),
		Code:        code,
		Subject:     "ServiceSettings.SiteURL",
		Severity:    string(healthcheck.SeverityWarning),
		State:       string(healthcheck.StateFiring),
		Area:        model.AreaCluster,
		Surface:     string(surface),
		MessageID:   "health.rule.site_url_http.message",
		Details:     map[string]string{"url": "http://example.com"},
		FirstSeenAt: now,
		LastSeenAt:  now,
		StateSince:  now,
	}
}

func storeHealthFindings(t *testing.T, th *TestHelper, findings ...*model.HealthFinding) {
	t.Helper()
	require.NoError(t, th.App.Srv().Store().HealthFinding().Upsert(findings))
}

func findingFingerprints(findings []*model.HealthFinding) []string {
	fingerprints := make([]string, 0, len(findings))
	for _, finding := range findings {
		fingerprints = append(fingerprints, finding.Fingerprint)
	}
	return fingerprints
}

func TestHealthDashboardAccess(t *testing.T) {
	t.Run("unauthenticated", func(t *testing.T) {
		th := setupHealthDashboard(t, true)

		_, resp, err := th.CreateClient().GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("non-admin", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
		storeHealthFindings(t, th, finding)

		_, resp, err := th.Client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = th.Client.MuteHealthFinding(context.Background(), finding.Fingerprint)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = th.Client.UnmuteHealthFinding(context.Background(), finding.Fingerprint)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-admin with the flag off", func(t *testing.T) {
		th := setupHealthDashboard(t, false)

		_, resp, err := th.Client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("flag off", func(t *testing.T) {
		th := setupHealthDashboard(t, false)

		_, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("no license", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.App.Srv().SetLicense(nil)

		_, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("license below Enterprise", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

		_, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("admin with the flag and license", func(t *testing.T) {
		th := setupHealthDashboard(t, true)

		list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Empty(t, list.Findings)
		assert.Zero(t, list.EvaluatedAt)
	})
}

func TestHealthDashboardLocal(t *testing.T) {
	th := setupHealthDashboard(t, true)
	finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	storeHealthFindings(t, th, finding)

	t.Run("get is served", func(t *testing.T) {
		list, resp, err := th.LocalClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Equal(t, []string{finding.Fingerprint}, findingFingerprints(list.Findings))
	})

	t.Run("mute is not routed", func(t *testing.T) {
		resp, err := th.LocalClient.MuteHealthFinding(context.Background(), finding.Fingerprint)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		resp, err = th.LocalClient.UnmuteHealthFinding(context.Background(), finding.Fingerprint)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		stored, err := th.App.Srv().Store().HealthFinding().GetByFingerprints([]string{finding.Fingerprint})
		require.NoError(t, err)
		require.Len(t, stored, 1)
		assert.False(t, stored[0].IsMuted())
	})
}

func TestGetHealthFindingsMutedFilter(t *testing.T) {
	th := setupHealthDashboard(t, true)
	unmuted := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	muted := newHealthFinding("SITE_URL_EMPTY", healthcheck.SurfaceProduct)
	muted.MessageID = "health.rule.site_url_empty.message"
	storeHealthFindings(t, th, unmuted, muted)
	require.NoError(t, th.App.Srv().Store().HealthFinding().Mute(muted.Fingerprint, th.SystemAdminUser.Id, model.GetMillis()))

	for _, tc := range []struct {
		muted    model.MutedFilter
		expected []string
	}{
		{model.MutedExcluded, []string{unmuted.Fingerprint}},
		{model.MutedIncluded, []string{unmuted.Fingerprint, muted.Fingerprint}},
		{model.MutedOnly, []string{muted.Fingerprint}},
	} {
		t.Run("muted="+string(tc.muted), func(t *testing.T) {
			list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{Muted: tc.muted})
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			assert.ElementsMatch(t, tc.expected, findingFingerprints(list.Findings))
		})
	}

	t.Run("invalid value", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/health/findings?muted=all", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(resp))
	})
}

func TestGetHealthFindingsRendering(t *testing.T) {
	th := setupHealthDashboard(t, true)
	finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	unregistered := newHealthFinding("NO_SUCH_RULE", healthcheck.SurfaceProduct)
	storeHealthFindings(t, th, finding, unregistered)

	t.Run("store rows carry no prose", func(t *testing.T) {
		stored, err := th.App.Srv().Store().HealthFinding().List(model.HealthFindingFilter{Muted: model.MutedIncluded})
		require.NoError(t, err)
		require.Len(t, stored, 2)
		for _, f := range stored {
			assert.Empty(t, f.Title)
			assert.Empty(t, f.Remediation)
			assert.Empty(t, f.Message)
			assert.Empty(t, f.DocsURL)
			assert.Empty(t, f.ConsolePath)
		}
	})

	t.Run("response is rendered and drops unregistered codes", func(t *testing.T) {
		list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, list.Findings, 1)

		rendered := list.Findings[0]
		assert.Equal(t, finding.Fingerprint, rendered.Fingerprint)
		assert.Equal(t, "SiteURL uses http:// (not https)", rendered.Title)
		assert.Equal(t, "Serve via HTTPS and update SiteURL accordingly.", rendered.Remediation)
		assert.Equal(t, "SiteURL is http://example.com. Session cookies and auth tokens traverse cleartext.", rendered.Message)
		assert.Equal(t, finding.MessageID, rendered.MessageID)
		assert.Equal(t, "https://mattermost.com/pl/configure-site-url", rendered.DocsURL)
		assert.Equal(t, "/admin_console/environment/web_server", rendered.ConsolePath)
	})

	t.Run("untranslated locale falls back to English", func(t *testing.T) {
		english, _, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)

		client := th.CreateClient()
		client.SetToken(th.SystemAdminClient.AuthToken)
		client.HTTPHeader = map[string]string{"Accept-Language": "fr"}
		french, resp, err := client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, french.Findings, 1)
		require.Len(t, english.Findings, 1)
		assert.Equal(t, english.Findings[0].Title, french.Findings[0].Title)
		assert.Equal(t, english.Findings[0].Message, french.Findings[0].Message)
		assert.Equal(t, english.Findings[0].Remediation, french.Findings[0].Remediation)
	})
}

func TestRenderHealthFindingsLocale(t *testing.T) {
	th := setupHealthDashboard(t, true)
	finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)

	translations := bundle.New()
	require.NoError(t, translations.ParseTranslationFileBytes("en.json", []byte(`[{"id": "health.rule.site_url_http.message", "translation": "SiteURL is {{.url}}."}]`)))
	require.NoError(t, translations.ParseTranslationFileBytes("de.json", []byte(`[{"id": "health.rule.site_url_http.message", "translation": "SiteURL ist {{.url}}."}]`)))

	render := func(locale string) *model.HealthFinding {
		c := &Context{
			App:        th.App,
			AppContext: th.Context.WithT(i18n.TranslateFunc(translations.MustTfunc(locale))),
		}
		rendered := renderFindings(c, []*model.HealthFinding{finding})
		require.Len(t, rendered, 1)
		return rendered[0]
	}

	english := render("en")
	german := render("de")
	assert.Equal(t, "SiteURL is http://example.com.", english.Message)
	assert.Equal(t, "SiteURL ist http://example.com.", german.Message)
	assert.Equal(t, english.MessageID, german.MessageID)
}

func TestGetHealthFindingsHidesInternalSurface(t *testing.T) {
	th := setupHealthDashboard(t, true)

	product := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	internal := newHealthFinding("SITE_URL_EMPTY", healthcheck.SurfaceInternal)
	storeHealthFindings(t, th, product, internal)

	for name, client := range map[string]*model.Client4{
		"system admin": th.SystemAdminClient,
		"local":        th.LocalClient,
	} {
		t.Run(name, func(t *testing.T) {
			for _, muted := range []model.MutedFilter{model.MutedExcluded, model.MutedIncluded} {
				list, resp, err := client.GetHealthFindings(context.Background(), model.HealthFindingFilter{Muted: muted})
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				assert.Equal(t, []string{product.Fingerprint}, findingFingerprints(list.Findings))
			}
		})
	}
}

func TestGetHealthFindingsEvaluatedAt(t *testing.T) {
	th := setupHealthDashboard(t, true)

	muted := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	internal := newHealthFinding("SITE_URL_EMPTY", healthcheck.SurfaceInternal)
	internal.LastSeenAt = muted.LastSeenAt + 1000
	storeHealthFindings(t, th, muted, internal)
	require.NoError(t, th.App.Srv().Store().HealthFinding().Mute(muted.Fingerprint, th.SystemAdminUser.Id, model.GetMillis()))

	for _, tc := range []struct {
		muted    model.MutedFilter
		expected []string
	}{
		{model.MutedExcluded, []string{}},
		{model.MutedIncluded, []string{muted.Fingerprint}},
		{model.MutedOnly, []string{muted.Fingerprint}},
	} {
		t.Run("muted="+string(tc.muted), func(t *testing.T) {
			list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{Muted: tc.muted})
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			assert.Equal(t, tc.expected, findingFingerprints(list.Findings))
			assert.Equal(t, internal.LastSeenAt, list.EvaluatedAt)
		})
	}
}

func TestMuteHealthFinding(t *testing.T) {
	th := setupHealthDashboard(t, true)
	finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	storeHealthFindings(t, th, finding)
	unknown := healthcheck.Fingerprint("NO_SUCH_RULE", "", "")

	getStored := func() *model.HealthFinding {
		stored, err := th.App.Srv().Store().HealthFinding().GetByFingerprints([]string{finding.Fingerprint})
		require.NoError(t, err)
		require.Len(t, stored, 1)
		return stored[0]
	}

	t.Run("mute is idempotent", func(t *testing.T) {
		for range 2 {
			resp, err := th.SystemAdminClient.MuteHealthFinding(context.Background(), finding.Fingerprint)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		}

		stored := getStored()
		assert.True(t, stored.IsMuted())
		assert.Equal(t, th.SystemAdminUser.Id, stored.MutedBy)
	})

	t.Run("unmute is idempotent", func(t *testing.T) {
		for range 2 {
			resp, err := th.SystemAdminClient.UnmuteHealthFinding(context.Background(), finding.Fingerprint)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		}

		stored := getStored()
		assert.False(t, stored.IsMuted())
		assert.Empty(t, stored.MutedBy)
	})

	t.Run("unknown fingerprint", func(t *testing.T) {
		resp, err := th.SystemAdminClient.MuteHealthFinding(context.Background(), unknown)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		resp, err = th.SystemAdminClient.UnmuteHealthFinding(context.Background(), unknown)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("internal-surface finding", func(t *testing.T) {
		internal := newHealthFinding("SITE_URL_EMPTY", healthcheck.SurfaceInternal)
		storeHealthFindings(t, th, internal)

		resp, err := th.SystemAdminClient.MuteHealthFinding(context.Background(), internal.Fingerprint)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		require.NoError(t, th.App.Srv().Store().HealthFinding().Mute(internal.Fingerprint, th.SystemAdminUser.Id, model.GetMillis()))
		resp, err = th.SystemAdminClient.UnmuteHealthFinding(context.Background(), internal.Fingerprint)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		stored, err := th.App.Srv().Store().HealthFinding().GetByFingerprints([]string{internal.Fingerprint})
		require.NoError(t, err)
		require.Len(t, stored, 1)
		assert.True(t, stored[0].IsMuted())
	})
}

func TestMuteHealthFindingAudit(t *testing.T) {
	logFile, err := os.CreateTemp("", "health_dashboard_audit.log")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, logFile.Close())
		require.NoError(t, os.Remove(logFile.Name()))
	})

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = true
		cfg.ExperimentalAuditSettings.FileEnabled = new(true)
		cfg.ExperimentalAuditSettings.FileName = new(logFile.Name())
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	storeHealthFindings(t, th, finding)

	resp, err := th.SystemAdminClient.MuteHealthFinding(context.Background(), finding.Fingerprint)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	resp, err = th.SystemAdminClient.UnmuteHealthFinding(context.Background(), finding.Fingerprint)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	require.NoError(t, th.Server.Audit.Flush())
	require.NoError(t, logFile.Sync())
	data, err := os.ReadFile(logFile.Name())
	require.NoError(t, err)

	for _, event := range []string{model.AuditEventMuteHealthFinding, model.AuditEventUnmuteHealthFinding} {
		var entries []*AuditEntry
		for line := range strings.SplitSeq(string(data), "\n") {
			if entry := FindAuditEntry(line, event, th.SystemAdminUser.Id); entry != nil {
				entries = append(entries, entry)
			}
		}

		require.Len(t, entries, 1, event)
		assert.Equal(t, model.AuditStatusSuccess, entries[0].Status, event)
		assert.Equal(t, finding.Fingerprint, entries[0].Parameters["fingerprint"], event)
		assert.Equal(t, finding.Code, entries[0].Parameters["code"], event)
	}
}

func TestHealthCheckPushURLRoundTrip(t *testing.T) {
	th := setupHealthDashboard(t, true)

	setPushServer := func(url string) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
			cfg.EmailSettings.PushNotificationServer = model.NewPointer(url)
		})
	}

	checkPushFindings := func() map[string]*model.HealthFinding {
		t.Helper()
		require.NoError(t, th.App.RunHealthCheck(th.Context))

		list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		byCode := map[string]*model.HealthFinding{}
		for _, f := range list.Findings {
			if strings.HasPrefix(f.Code, "PUSH_") {
				byCode[f.Code] = f
			}
		}
		return byCode
	}

	setPushServer("https://push.example.com")
	assert.Empty(t, checkPushFindings())

	setPushServer("http://push.example.com")
	firing := checkPushFindings()
	require.Len(t, firing, 1)
	badScheme := firing["PUSH_BAD_SCHEME"]
	require.NotNil(t, badScheme)
	assert.Equal(t, string(healthcheck.StateFiring), badScheme.State)
	assert.Equal(t, "health.rule.push_bad_scheme.message.http", badScheme.MessageID)
	assert.NotEmpty(t, badScheme.Message)

	setPushServer("https://push.example.com")
	after := checkPushFindings()
	require.Len(t, after, 1)
	cleared := after["PUSH_BAD_SCHEME"]
	require.NotNil(t, cleared)
	assert.Equal(t, string(healthcheck.StateResolved), cleared.State)
	assert.Equal(t, badScheme.Fingerprint, cleared.Fingerprint)
	assert.Equal(t, badScheme.FirstSeenAt, cleared.FirstSeenAt)
}
