// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"maps"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

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

func jobIDs(jobs []*model.Job) []string {
	ids := make([]string, 0, len(jobs))
	for _, job := range jobs {
		ids = append(ids, job.Id)
	}
	return ids
}

func checkHealthDashboardNotImplemented(t *testing.T, th *TestHelper) {
	t.Helper()

	finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	storeHealthFindings(t, th, finding)

	_, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	resp, err = th.SystemAdminClient.MuteHealthFinding(context.Background(), finding.Fingerprint)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	resp, err = th.SystemAdminClient.UnmuteHealthFinding(context.Background(), finding.Fingerprint)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	_, resp, err = th.SystemAdminClient.CreateJob(context.Background(), &model.Job{Type: model.JobTypeHealthCheck})
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	_, _, resp, err = th.SystemAdminClient.ExportHealthFindings(context.Background(), "md")
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	stored, err := th.App.Srv().Store().HealthFinding().GetByFingerprints([]string{finding.Fingerprint})
	require.NoError(t, err)
	require.Len(t, stored, 1)
	assert.False(t, stored[0].IsMuted())
	assert.Empty(t, healthCheckJobs(t, th))
}

func healthCheckJobs(t *testing.T, th *TestHelper) []*model.Job {
	t.Helper()
	jobs, err := th.App.Srv().Store().Job().GetAllByType(th.Context, model.JobTypeHealthCheck)
	require.NoError(t, err)
	return jobs
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

		_, resp, err = th.Client.CreateJob(context.Background(), &model.Job{Type: model.JobTypeHealthCheck})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Empty(t, healthCheckJobs(t, th))

		_, _, resp, err = th.Client.ExportHealthFindings(context.Background(), "md")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delegated admin who can read Site Statistics reads but cannot mute", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.LoginSystemManager(t)
		open := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
		muted := newHealthFinding("SITE_URL_EMPTY", healthcheck.SurfaceProduct)
		muted.MessageID = "health.rule.site_url_empty.message"
		storeHealthFindings(t, th, open, muted)
		require.NoError(t, th.App.Srv().Store().HealthFinding().Mute(muted.Fingerprint, th.SystemAdminUser.Id, model.GetMillis()))

		list, resp, err := th.SystemManagerClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{Muted: model.MutedIncluded})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.ElementsMatch(t, []string{open.Fingerprint, muted.Fingerprint}, findingFingerprints(list.Findings))

		resp, err = th.SystemManagerClient.MuteHealthFinding(context.Background(), open.Fingerprint)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = th.SystemManagerClient.UnmuteHealthFinding(context.Background(), muted.Fingerprint)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		stored, err := th.App.Srv().Store().HealthFinding().GetByFingerprints([]string{open.Fingerprint, muted.Fingerprint})
		require.NoError(t, err)
		mutedByFingerprint := map[string]bool{}
		for _, finding := range stored {
			mutedByFingerprint[finding.Fingerprint] = finding.IsMuted()
		}
		assert.Equal(t, map[string]bool{open.Fingerprint: false, muted.Fingerprint: true}, mutedByFingerprint)
	})

	t.Run("delegated admin who cannot read Site Statistics", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.LoginSystemManager(t)
		th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadReportingSiteStatistics.Id, model.SystemManagerRoleId)
		t.Cleanup(func() {
			th.AddPermissionToRole(t, model.PermissionSysconsoleReadReportingSiteStatistics.Id, model.SystemManagerRoleId)
		})

		_, resp, err := th.SystemManagerClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, _, resp, err = th.SystemManagerClient.ExportHealthFindings(context.Background(), "md")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("compliance and job findings follow the permissions of what they are about", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.LoginSystemManager(t)
		finding := func(code string, area model.HealthArea, subject string) *model.HealthFinding {
			f := newHealthFinding(code, healthcheck.SurfaceProduct)
			f.Fingerprint = healthcheck.Fingerprint(code, subject, "")
			f.Area = area
			f.Subject = subject
			return f
		}
		siteURL := finding("SITE_URL_HTTP", model.AreaPlatform, "ServiceSettings.SiteURL")
		export := finding("EXPORT_GR_TIMEOUT_LOW", model.AreaCompliance, "MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout")
		exportJob := finding("JOB_FAILED", model.AreaJobs, model.JobTypeMessageExport)
		ldapJob := finding("JOB_FAILED", model.AreaJobs, model.JobTypeLdapSync)
		storeHealthFindings(t, th, siteURL, export, exportJob, ldapJob)

		getFingerprints := func(client *model.Client4) []string {
			t.Helper()
			list, resp, err := client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			return findingFingerprints(list.Findings)
		}

		// A System Manager can read LDAP but not Compliance.
		assert.ElementsMatch(t, []string{siteURL.Fingerprint, ldapJob.Fingerprint}, getFingerprints(th.SystemManagerClient))
		data, _, resp, err := th.SystemManagerClient.ExportHealthFindings(context.Background(), "md")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Contains(t, string(data), "`SITE_URL_HTTP`")
		assert.NotContains(t, string(data), "`EXPORT_GR_TIMEOUT_LOW`", "the export leaves out what the list does")
		assert.ElementsMatch(t, []string{siteURL.Fingerprint, export.Fingerprint, exportJob.Fingerprint, ldapJob.Fingerprint}, getFingerprints(th.SystemAdminClient))

		// Granting Compliance Export read reveals the export findings, whatever the role.
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.SystemManagerRoleId)
		th.AddPermissionToRole(t, model.PermissionReadComplianceExportJob.Id, model.SystemManagerRoleId)
		t.Cleanup(func() {
			th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.SystemManagerRoleId)
			th.RemovePermissionFromRole(t, model.PermissionReadComplianceExportJob.Id, model.SystemManagerRoleId)
		})
		assert.ElementsMatch(t, []string{siteURL.Fingerprint, export.Fingerprint, exportJob.Fingerprint, ldapJob.Fingerprint}, getFingerprints(th.SystemManagerClient))
	})

	t.Run("manage_system reads every finding, whatever else its role holds", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.LoginSystemManager(t)
		export := newHealthFinding("EXPORT_GR_TIMEOUT_LOW", healthcheck.SurfaceProduct)
		export.Area = model.AreaCompliance
		export.Subject = "MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout"
		export.Fingerprint = healthcheck.Fingerprint(export.Code, export.Subject, "")
		exportJob := newHealthFinding("JOB_FAILED", healthcheck.SurfaceProduct)
		exportJob.Area = model.AreaJobs
		exportJob.Subject = model.JobTypeMessageExport
		exportJob.Fingerprint = healthcheck.Fingerprint(exportJob.Code, exportJob.Subject, "")
		storeHealthFindings(t, th, export, exportJob)

		getFingerprints := func(client *model.Client4) []string {
			t.Helper()
			list, resp, err := client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			return findingFingerprints(list.Findings)
		}

		th.AddPermissionToRole(t, model.PermissionManageSystem.Id, model.SystemManagerRoleId)
		t.Cleanup(func() {
			th.RemovePermissionFromRole(t, model.PermissionManageSystem.Id, model.SystemManagerRoleId)
		})
		assert.ElementsMatch(t, []string{export.Fingerprint, exportJob.Fingerprint}, getFingerprints(th.SystemManagerClient))

		th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.SystemAdminRoleId)
		th.RemovePermissionFromRole(t, model.PermissionReadComplianceExportJob.Id, model.SystemAdminRoleId)
		t.Cleanup(func() {
			th.AddPermissionToRole(t, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.SystemAdminRoleId)
			th.AddPermissionToRole(t, model.PermissionReadComplianceExportJob.Id, model.SystemAdminRoleId)
		})
		assert.ElementsMatch(t, []string{export.Fingerprint, exportJob.Fingerprint}, getFingerprints(th.SystemAdminClient))
	})

	t.Run("health check jobs follow the findings read permission", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.LoginSystemManager(t)
		job, err := th.App.Srv().Store().Job().Save(&model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeHealthCheck,
			Status: model.JobStatusSuccess,
		})
		require.NoError(t, err)

		for name, client := range map[string]*model.Client4{"system admin": th.SystemAdminClient, "system manager": th.SystemManagerClient} {
			t.Run(name, func(t *testing.T) {
				got, resp, err := client.GetJob(context.Background(), job.Id)
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				assert.Equal(t, job.Id, got.Id)

				jobs, resp, err := client.GetJobsByType(context.Background(), model.JobTypeHealthCheck, 0, 10)
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				require.Len(t, jobs, 1)
				assert.Equal(t, job.Id, jobs[0].Id)

				jobs, resp, err = client.GetJobs(context.Background(), "", "", 0, 100)
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				assert.Contains(t, jobIDs(jobs), job.Id)
			})
		}

		t.Run("non-admin", func(t *testing.T) {
			_, resp, err := th.Client.GetJob(context.Background(), job.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)

			_, resp, err = th.Client.GetJobsByType(context.Background(), model.JobTypeHealthCheck, 0, 10)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("system manager who cannot read Site Statistics", func(t *testing.T) {
			th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadReportingSiteStatistics.Id, model.SystemManagerRoleId)
			t.Cleanup(func() {
				th.AddPermissionToRole(t, model.PermissionSysconsoleReadReportingSiteStatistics.Id, model.SystemManagerRoleId)
			})

			_, resp, err := th.SystemManagerClient.GetJob(context.Background(), job.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)

			jobs, resp, err := th.SystemManagerClient.GetJobs(context.Background(), "", "", 0, 100)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			assert.NotContains(t, jobIDs(jobs), job.Id)
		})
	})

	t.Run("non-admin with the flag off", func(t *testing.T) {
		th := setupHealthDashboard(t, false)

		_, resp, err := th.Client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("flag off", func(t *testing.T) {
		th := setupHealthDashboard(t, false)
		checkHealthDashboardNotImplemented(t, th)
	})

	t.Run("no license", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.App.Srv().SetLicense(nil)
		checkHealthDashboardNotImplemented(t, th)
	})

	t.Run("license below Professional", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuE20))
		checkHealthDashboardNotImplemented(t, th)
	})

	t.Run("admin with the flag and a Professional license", func(t *testing.T) {
		th := setupHealthDashboard(t, true)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		finding := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
		storeHealthFindings(t, th, finding)

		list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, list.Findings, 1)
		assert.Equal(t, finding.Fingerprint, list.Findings[0].Fingerprint)

		resp, err = th.SystemAdminClient.MuteHealthFinding(context.Background(), finding.Fingerprint)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = th.SystemAdminClient.UnmuteHealthFinding(context.Background(), finding.Fingerprint)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, _, resp, err = th.SystemAdminClient.ExportHealthFindings(context.Background(), "md")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		job, resp, err := th.SystemAdminClient.CreateJob(context.Background(), &model.Job{Type: model.JobTypeHealthCheck})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Equal(t, model.JobStatusPending, job.Status)
		jobs := healthCheckJobs(t, th)
		require.Len(t, jobs, 1)
		assert.Equal(t, job.Id, jobs[0].Id)
	})

	t.Run("admin with the flag and an Enterprise license", func(t *testing.T) {
		th := setupHealthDashboard(t, true)

		list, resp, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Empty(t, list.Findings)
		assert.Zero(t, list.EvaluatedAt)
	})
}

// TestComplianceFindingPermissions keeps the stopgap map in step with the rules: a compliance rule
// missing from it is hidden from everyone without manage_system.
func TestComplianceFindingPermissions(t *testing.T) {
	var codes []string
	for _, rule := range healthcheck.Builtin().Rules() {
		if rule.Area == model.AreaCompliance {
			codes = append(codes, rule.Code)
		}
	}
	assert.ElementsMatch(t, codes, slices.Collect(maps.Keys(complianceFindingPermissions)))
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

	t.Run("a run can be started and followed", func(t *testing.T) {
		job, _, err := th.LocalClient.CreateJob(context.Background(), &model.Job{Type: model.JobTypeHealthCheck})
		require.NoError(t, err)
		assert.Equal(t, model.JobTypeHealthCheck, job.Type)

		got, _, err := th.LocalClient.GetJob(context.Background(), job.Id)
		require.NoError(t, err)
		assert.Equal(t, job.Id, got.Id)
	})

	t.Run("export is not routed", func(t *testing.T) {
		_, _, resp, err := th.LocalClient.ExportHealthFindings(context.Background(), "md")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
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
		assert.Equal(t, "SiteURL uses http:// (not https://)", rendered.Title)
		assert.Equal(t, "Serve Mattermost over HTTPS and update SiteURL to the https:// address.", rendered.Remediation)
		assert.Equal(t, "SiteURL is http://example.com. Session cookies and auth tokens travel over the network unencrypted.", rendered.Message)
		assert.Equal(t, finding.MessageID, rendered.MessageID)
		assert.Equal(t, "https://mattermost.com/pl/configure-site-url", rendered.DocsURL)
		assert.Equal(t, "/admin_console/environment/web_server", rendered.ConsolePath)
	})

	t.Run("unsupported locale falls back to English", func(t *testing.T) {
		english, _, err := th.SystemAdminClient.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)

		client := th.CreateClient()
		client.SetToken(th.SystemAdminClient.AuthToken)
		client.HTTPHeader = map[string]string{"Accept-Language": "sw"}
		swahili, resp, err := client.GetHealthFindings(context.Background(), model.HealthFindingFilter{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, swahili.Findings, 1)
		require.Len(t, english.Findings, 1)
		assert.Equal(t, english.Findings[0].Title, swahili.Findings[0].Title)
		assert.Equal(t, english.Findings[0].Message, swahili.Findings[0].Message)
		assert.Equal(t, english.Findings[0].Remediation, swahili.Findings[0].Remediation)
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
	storeHealthFindings(t, th, muted)
	require.NoError(t, th.App.Srv().Store().HealthFinding().Mute(muted.Fingerprint, th.SystemAdminUser.Id, model.GetMillis()))

	now := model.GetMillis()
	lastSuccess := &model.Job{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusSuccess, CreateAt: now - 2000, LastActivityAt: now - 1000}
	for _, job := range []*model.Job{
		{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusSuccess, CreateAt: now - 4000, LastActivityAt: now - 3000},
		lastSuccess,
		// A run that failed or is still going has not evaluated anything.
		{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusError, CreateAt: now - 500, LastActivityAt: now - 400},
		{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusInProgress, CreateAt: now - 300, LastActivityAt: now - 200},
	} {
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
	}

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
			assert.Equal(t, lastSuccess.LastActivityAt, list.EvaluatedAt)
		})
	}
}

func TestExportHealthFindings(t *testing.T) {
	th := setupHealthDashboard(t, true)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.TeamSettings.SiteName = model.NewPointer("Acme Corp.")
		cfg.ServiceSettings.SiteURL = model.NewPointer("https://chat.example.com")
	})

	const timezone = "Pacific/Kiritimati"
	location, err := time.LoadLocation(timezone)
	require.NoError(t, err)
	th.SystemAdminUser.Timezone = model.StringMap{"useAutomaticTimezone": "false", "manualTimezone": timezone}
	_, appErr := th.App.UpdateUser(th.Context, th.SystemAdminUser, false)
	require.Nil(t, appErr)

	open := newHealthFinding("SITE_URL_HTTP", healthcheck.SurfaceProduct)
	muted := newHealthFinding("SITE_URL_EMPTY", healthcheck.SurfaceProduct)
	resolved := newHealthFinding("PUSH_BAD_SCHEME", healthcheck.SurfaceProduct)
	resolved.State = string(healthcheck.StateResolved)
	internal := newHealthFinding("PUSH_PROXY_UNREACHABLE", healthcheck.SurfaceInternal)
	storeHealthFindings(t, th, open, muted, resolved, internal)
	require.NoError(t, th.App.Srv().Store().HealthFinding().Mute(muted.Fingerprint, th.SystemAdminUser.Id, model.GetMillis()))

	for _, tc := range []struct {
		format      string
		contentType string
	}{
		{"html", "text/html; charset=utf-8"},
		{"md", "text/markdown; charset=utf-8"},
	} {
		t.Run(tc.format, func(t *testing.T) {
			before := time.Now().In(location)
			data, filename, resp, err := th.SystemAdminClient.ExportHealthFindings(context.Background(), tc.format)
			after := time.Now().In(location)
			require.NoError(t, err)
			CheckOKStatus(t, resp)

			assert.Equal(t, tc.contentType, resp.Header.Get("Content-Type"))
			assert.Equal(t, "nosniff", resp.Header.Get("X-Content-Type-Options"))
			assert.Equal(t, "no-store", resp.Header.Get("Cache-Control"))
			assert.Contains(t, []string{
				"mm_site_health_My_awesome_Company_" + before.Format("2006-01-02T15-04") + "." + tc.format,
				"mm_site_health_My_awesome_Company_" + after.Format("2006-01-02T15-04") + "." + tc.format,
			}, filename)
			assert.Equal(t, `attachment; filename="`+filename+`"`, resp.Header.Get("Content-Disposition"))

			report := string(data)
			if tc.format == "html" {
				assert.Contains(t, report, "<title>"+strings.TrimSuffix(filename, ".html")+"</title>", "printing suggests the export's name")
			}
			assert.NotContains(t, report, "Acme Corp")
			assert.Contains(t, report, "https://chat.example.com/admin_console/environment/web_server")
			assert.Contains(t, report, "My awesome Company")
			assert.Contains(t, report, model.CurrentVersion)
			assert.Contains(t, report, "SiteURL uses http:// (not https://)")
			assert.NotContains(t, report, "Push notification server connection test failed")
		})
	}

	t.Run("markdown sections and timezone", func(t *testing.T) {
		data, _, _, err := th.SystemAdminClient.ExportHealthFindings(context.Background(), "md")
		require.NoError(t, err)

		report := string(data)
		assert.Contains(t, report, " +14\n", "times are in the admin's timezone")
		assert.Contains(t, report, "\n- **License:** Enterprise\n")
		assert.Contains(t, report, "\n## Muted\n\n- **ServiceSettings.SiteURL is empty** `SITE_URL_EMPTY` (Warning)")
		assert.Contains(t, report, "\n## Resolved\n\n- PushNotificationServer does not use https:// `PUSH_BAD_SCHEME`\n")
	})

	t.Run("html declares the request's language", func(t *testing.T) {
		for acceptLanguage, lang := range map[string]string{
			"":               "en",
			"fr":             "fr",
			"pt-BR,pt;q=0.9": "pt-BR",
			"sw":             "en",
		} {
			client := th.CreateClient()
			client.SetToken(th.SystemAdminClient.AuthToken)
			client.HTTPHeader = map[string]string{"Accept-Language": acceptLanguage}
			data, _, resp, err := client.ExportHealthFindings(context.Background(), "html")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			assert.Contains(t, string(data), `<html lang="`+lang+`">`, "Accept-Language: %q", acceptLanguage)
		}
	})

	t.Run("invalid format", func(t *testing.T) {
		for _, format := range []string{"", "pdf"} {
			_, _, resp, err := th.SystemAdminClient.ExportHealthFindings(context.Background(), format)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		}
	})
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

func TestHealthDashboardAudit(t *testing.T) {
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
	_, _, resp, err = th.SystemAdminClient.ExportHealthFindings(context.Background(), "html")
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	require.NoError(t, th.Server.Audit.Flush())
	require.NoError(t, logFile.Sync())
	data, err := os.ReadFile(logFile.Name())
	require.NoError(t, err)

	findEntries := func(event string) []*AuditEntry {
		var entries []*AuditEntry
		for line := range strings.SplitSeq(string(data), "\n") {
			if entry := FindAuditEntry(line, event, th.SystemAdminUser.Id); entry != nil {
				entries = append(entries, entry)
			}
		}
		return entries
	}

	for _, event := range []string{model.AuditEventMuteHealthFinding, model.AuditEventUnmuteHealthFinding} {
		entries := findEntries(event)
		require.Len(t, entries, 1, event)
		assert.Equal(t, model.AuditStatusSuccess, entries[0].Status, event)
		assert.Equal(t, finding.Fingerprint, entries[0].Parameters["fingerprint"], event)
		assert.Equal(t, finding.Code, entries[0].Parameters["code"], event)
	}

	entries := findEntries(model.AuditEventExportHealthFindings)
	require.Len(t, entries, 1)
	assert.Equal(t, model.AuditStatusSuccess, entries[0].Status)
	assert.Equal(t, "html", entries[0].Parameters["format"])
}

func TestHealthCheckPushURLRoundTrip(t *testing.T) {
	th := setupHealthDashboard(t, true)

	const (
		unreachableHTTPS = "https://127.0.0.1:0"
		badSchemeHTTP    = "http://127.0.0.1:0"
	)

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
			if f.Subject == "EmailSettings.PushNotificationServer" {
				byCode[f.Code] = f
			}
		}
		return byCode
	}

	setPushServer(unreachableHTTPS)
	initial := checkPushFindings()
	require.Len(t, initial, 1)
	unreachable := initial["PUSH_PROXY_UNREACHABLE"]
	require.NotNil(t, unreachable)
	assert.Equal(t, string(healthcheck.StateFiring), unreachable.State)
	assert.Equal(t, "health.rule.push_proxy_unreachable.message", unreachable.MessageID)
	assert.NotEmpty(t, unreachable.Message)

	setPushServer(badSchemeHTTP)
	firing := checkPushFindings()
	require.Len(t, firing, 2)
	badScheme := firing["PUSH_BAD_SCHEME"]
	require.NotNil(t, badScheme)
	assert.Equal(t, string(healthcheck.StateFiring), badScheme.State)
	assert.Equal(t, "health.rule.push_bad_scheme.message.http", badScheme.MessageID)
	assert.NotEmpty(t, badScheme.Message)
	unreachableCleared := firing["PUSH_PROXY_UNREACHABLE"]
	require.NotNil(t, unreachableCleared)
	assert.Equal(t, string(healthcheck.StateResolved), unreachableCleared.State)
	assert.Equal(t, unreachable.Fingerprint, unreachableCleared.Fingerprint)
	assert.Equal(t, unreachable.FirstSeenAt, unreachableCleared.FirstSeenAt)

	setPushServer(unreachableHTTPS)
	after := checkPushFindings()
	require.Len(t, after, 2)
	cleared := after["PUSH_BAD_SCHEME"]
	require.NotNil(t, cleared)
	assert.Equal(t, string(healthcheck.StateResolved), cleared.State)
	assert.Equal(t, badScheme.Fingerprint, cleared.Fingerprint)
	assert.Equal(t, badScheme.FirstSeenAt, cleared.FirstSeenAt)
	unreachableAgain := after["PUSH_PROXY_UNREACHABLE"]
	require.NotNil(t, unreachableAgain)
	assert.Equal(t, string(healthcheck.StateFiring), unreachableAgain.State)
	assert.Equal(t, unreachable.Fingerprint, unreachableAgain.Fingerprint)
	assert.Equal(t, unreachable.FirstSeenAt, unreachableAgain.FirstSeenAt)
}

// A run is started and followed through the generic jobs API: POST /api/v4/jobs routes health_check
// to App.StartHealthCheckRun, which returns the active run instead of starting a second one.
func TestHealthCheckRun(t *testing.T) {
	th := setupHealthDashboard(t, true)
	client := th.SystemAdminClient
	start := func() *model.Job {
		t.Helper()
		job, resp, err := client.CreateJob(context.Background(), &model.Job{Type: model.JobTypeHealthCheck})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		return job
	}

	first := start()
	assert.Equal(t, model.JobStatusPending, first.Status)

	t.Run("starting while pending returns the pending run", func(t *testing.T) {
		assert.Equal(t, first.Id, start().Id)
		assert.Len(t, healthCheckJobs(t, th), 1)
	})

	t.Run("starting while in progress returns the running run", func(t *testing.T) {
		first.Status = model.JobStatusInProgress
		first.LastActivityAt = model.GetMillis()
		_, err := th.App.Srv().Store().Job().UpdateOptimistically(first, model.JobStatusPending)
		require.NoError(t, err)

		assert.Equal(t, first.Id, start().Id)
		assert.Len(t, healthCheckJobs(t, th), 1)
	})

	t.Run("the run can't be canceled", func(t *testing.T) {
		resp, err := client.CancelJob(context.Background(), first.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		got, _, err := client.GetJob(context.Background(), first.Id)
		require.NoError(t, err)
		assert.Equal(t, model.JobStatusInProgress, got.Status)
	})

	t.Run("the run is followed through GET /api/v4/jobs/{id}", func(t *testing.T) {
		first.Status = model.JobStatusError
		first.Data = map[string]string{"error": "collect failed"}
		_, err := th.App.Srv().Store().Job().UpdateOptimistically(first, model.JobStatusInProgress)
		require.NoError(t, err)

		got, _, err := client.GetJob(context.Background(), first.Id)
		require.NoError(t, err)
		assert.Equal(t, model.JobStatusError, got.Status)
		assert.Equal(t, "collect failed", got.Data["error"])
	})

	t.Run("starting after a finished run creates a new one", func(t *testing.T) {
		assert.NotEqual(t, first.Id, start().Id)
		assert.Len(t, healthCheckJobs(t, th), 2)
	})
}
