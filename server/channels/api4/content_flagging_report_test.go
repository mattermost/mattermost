// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func TestGenerateFlaggedPostReport(t *testing.T) {
	th := Setup(t).InitBasic(t)

	client := th.Client
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	defer th.RemoveLicense(t)

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost(t)
		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 400 when post ID is invalid", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), "invalid", &model.FlagContentActionRequest{})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 403 when user is not a reviewer", func(t *testing.T) {
		appErr := setNonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 404 when post is not flagged", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should successfully generate report for a flagged post", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "investigation note"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		zr, err := zip.NewReader(bytes.NewReader(report), int64(len(report)))
		require.NoError(t, err)

		entries := map[string]bool{}
		for _, f := range zr.File {
			entries[f.Name] = true
		}
		require.Contains(t, entries, "report_metadata.yaml")
		require.Contains(t, entries, "post/post.yaml")
		require.Contains(t, entries, "content_review.yaml")
	})

	t.Run("Should successfully generate report when user is a team reviewer", func(t *testing.T) {
		appErr := setBasicTeamReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "investigation note"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)
	})

	t.Run("Should include file attachments in the generated report", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post, fileInfo := uploadFileAndCreatePost(t, th, client)
		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "investigation note"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		zr, err := zip.NewReader(bytes.NewReader(report), int64(len(report)))
		require.NoError(t, err)

		var foundAttachment bool
		for _, f := range zr.File {
			if f.Name == "post/attachments/"+fileInfo.Id+"_"+fileInfo.Name {
				foundAttachment = true
				break
			}
		}
		require.True(t, foundAttachment, "attachment for the flagged post should be present in the report archive")
	})

	t.Run("Should include reviewer decision from request action", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{
			Comment: "investigation note",
			Action:  model.ContentFlaggingActionRemove,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		zr, err := zip.NewReader(bytes.NewReader(report), int64(len(report)))
		require.NoError(t, err)

		var review model.FlaggedPostReportContentReview
		var found bool
		for _, f := range zr.File {
			if f.Name != "content_review.yaml" {
				continue
			}
			rc, err := f.Open()
			require.NoError(t, err)
			b, err := io.ReadAll(rc)
			require.NoError(t, err)
			_ = rc.Close()
			require.NoError(t, yaml.Unmarshal(b, &review))
			found = true
			break
		}
		require.True(t, found, "content_review.yaml should be present in the report archive")
		require.Equal(t, "remove", review.ActorDecision)
		require.Equal(t, th.BasicUser.Id, review.ActorUserId)
		require.Equal(t, th.BasicUser.Username, review.ActorUsername)
	})

	t.Run("Should include edit history entries in the generated report", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)

		post.Message = "Updated message to create edit history"
		_, _, err := client.UpdatePost(context.Background(), post.Id, post)
		require.NoError(t, err)

		editHistory, appErr := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.NotEmpty(t, editHistory)
		editId := editHistory[0].Id

		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "investigation note"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		zr, err := zip.NewReader(bytes.NewReader(report), int64(len(report)))
		require.NoError(t, err)

		var foundEdit bool
		for _, f := range zr.File {
			if f.Name == "edit_history/"+editId+"/post.yaml" {
				foundEdit = true
				break
			}
		}
		require.True(t, foundEdit, "edit history entry should be present in the report archive")
	})

	t.Run("Should not allow generating a report for a post in a DM channel", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := createDmPost(t, th, client)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.data_spillage.error.invalid_channel_type")
		require.Empty(t, report)
	})

	t.Run("Should not allow generating a report for a post in a GM channel", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := createGmPost(t, th, client)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.data_spillage.error.invalid_channel_type")
		require.Empty(t, report)
	})
}

// parseExposureCSV skips the "#"-prefixed metadata preamble and returns the remaining records.
func parseExposureCSV(t *testing.T, b []byte) [][]string {
	t.Helper()

	r := csv.NewReader(bytes.NewReader(b))
	r.Comment = '#'
	records, err := r.ReadAll()
	require.NoError(t, err)
	return records
}

func TestGeneratePostExposureReport(t *testing.T) {
	th := Setup(t).InitBasic(t)

	client := th.Client
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	defer th.RemoveLicense(t)

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost(t)
		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 400 when post ID is invalid", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		report, resp, err := client.GeneratePostExposureReport(context.Background(), "invalid")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 403 when user is not a reviewer", func(t *testing.T) {
		appErr := setNonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 404 when post is not flagged", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should successfully generate report when the post has already been retained", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		resp, err := client.KeepFlaggedPost(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "looks fine"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		require.Contains(t, resp.Header.Get("Content-Type"), "text/csv")
		require.Contains(t, resp.Header.Get("Content-Disposition"), "attachment; filename=\"post-exposure-"+post.Id)
	})

	t.Run("Should successfully generate report when the post has already been removed", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		resp, err := client.RemoveFlaggedPost(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "confirmed spillage"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Removal scrubs the post's content but retains a stub row, and it never deletes
		// the reporting_time property, so the exposure window is still computable.
		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		require.Contains(t, resp.Header.Get("Content-Type"), "text/csv")
		require.Contains(t, resp.Header.Get("Content-Disposition"), "attachment; filename=\"post-exposure-"+post.Id)
	})

	t.Run("Should successfully generate report for a common reviewer", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		require.Contains(t, resp.Header.Get("Content-Type"), "text/csv")
		require.Contains(t, resp.Header.Get("Content-Disposition"), "attachment; filename=\"post-exposure-"+post.Id)
	})

	t.Run("Should successfully generate report when user is a team reviewer", func(t *testing.T) {
		appErr := setBasicTeamReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)
	})

	t.Run("Should generate report for both the assignee and a non-assignee reviewer", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th, th.BasicUser2.Id)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, th.BasicUser2.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// BasicUser is a reviewer but not the assignee.
		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)

		// BasicUser2 is the assignee, and is therefore also a reviewer.
		assigneeClient := th.CreateClient()
		th.LoginBasic2WithClient(t, assigneeClient)

		report, resp, err = assigneeClient.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotEmpty(t, report)
	})

	t.Run("Should return a parseable CSV listing the channel members", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		report, _, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.NoError(t, err)

		body := string(report)
		require.Contains(t, body, "# Post ID: "+post.Id)
		require.Contains(t, body, "# Report version: "+model.PostExposureReportVersion)

		records := parseExposureCSV(t, report)
		require.NotEmpty(t, records)
		require.Equal(t, model.PostExposureReportCSVHeader(i18n.GetUserTranslations("en")), records[0])

		var found bool
		for _, record := range records[1:] {
			if record[0] == th.BasicUser.Id {
				found = true
				require.Equal(t, th.BasicUser.Username, record[1])
			}
		}
		require.True(t, found, "the post author is a channel member and must appear in the report")
	})

	t.Run("Should return 403 in team reviewer mode for a user not on the team's reviewer list", func(t *testing.T) {
		appErr := setBasicTeamReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		otherClient := th.CreateClient()
		th.LoginBasic2WithClient(t, otherClient)

		report, resp, err := otherClient.GeneratePostExposureReport(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Empty(t, report)
	})
}

func readReportArchive(t *testing.T, report []byte) map[string][]byte {
	t.Helper()

	zr, err := zip.NewReader(bytes.NewReader(report), int64(len(report)))
	require.NoError(t, err)

	out := map[string][]byte{}
	for _, f := range zr.File {
		rc, err := f.Open()
		require.NoError(t, err)
		b, err := io.ReadAll(rc)
		require.NoError(t, err)
		_ = rc.Close()
		out[f.Name] = b
	}
	return out
}

func TestGenerateFlaggedPostReportFileDownloadPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	client := th.Client
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	defer th.RemoveLicense(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	withDownloadDecision := func(t *testing.T, channelID string, allowed bool) {
		t.Helper()

		mockACS := &mocks.AccessControlServiceInterface{}
		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == channelID && req.Action == model.AccessControlPolicyActionDownloadFileAttachment
		})).Return(model.AccessDecision{Decision: allowed}, (*model.AppError)(nil))

		// Only the decision under test is pinned; unrelated evaluations must not trip the mock.
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil)).Maybe()
	}

	t.Run("Should include attachments when the download policy allows the reviewer", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post, fileInfo := uploadFileAndCreatePost(t, th, client)
		flagPostViaAPI(t, client, post.Id)
		withDownloadDecision(t, post.ChannelId, true)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entries := readReportArchive(t, report)
		require.Contains(t, entries, "post/attachments/"+fileInfo.Id+"_"+fileInfo.Name)
		require.NotContains(t, entries, "ATTACHMENTS_OMITTED.txt")
	})

	t.Run("Should omit attachments without failing the request when the download policy denies the reviewer", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post, fileInfo := uploadFileAndCreatePost(t, th, client)
		flagPostViaAPI(t, client, post.Id)
		withDownloadDecision(t, post.ChannelId, false)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entries := readReportArchive(t, report)
		for name := range entries {
			require.NotContains(t, name, fileInfo.Id, "no archive entry should be named after an omitted attachment")
		}
		require.Contains(t, entries, "ATTACHMENTS_OMITTED.txt")
		require.Contains(t, entries, "post/post.yaml")
		require.Contains(t, entries, "content_review.yaml")
		require.Contains(t, entries, "report_metadata.yaml")
		require.Contains(t, entries, "exposure_report.csv")
	})
}

func TestGenerateFlaggedPostReportAttachmentsOmittedAudit(t *testing.T) {
	logFile, err := os.CreateTemp(t.TempDir(), "audit.log")
	require.NoError(t, err)
	defer logFile.Close()

	options := []app.Option{app.WithLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced, "advanced_logging"))}
	th := SetupWithServerOptionsAndConfig(t, options, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(true)
		cfg.ExperimentalAuditSettings.FileName = model.NewPointer(logFile.Name())
	}).InitBasic(t)

	client := th.Client

	// WithLicense seeds the license early enough for the audit sink to come up; the
	// test helper clears it again during setup, so re-apply it for content flagging.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced, "advanced_logging"))
	defer th.RemoveLicense(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	appErr := setBasicCommonReviewerConfig(th)
	require.Nil(t, appErr)

	post, _ := uploadFileAndCreatePost(t, th, client)
	flagPostViaAPI(t, client, post.Id)

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	defer func() { th.App.Srv().Channels().AccessControl = original }()
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

	_, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	require.NoError(t, th.Server.Audit.Flush())
	require.NoError(t, logFile.Sync())

	data, err := io.ReadAll(logFile)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	entry := FindAuditEntry(string(data), "generateFlaggedPostReport", th.BasicUser.Id)
	require.NotNil(t, entry, "should find a generateFlaggedPostReport audit entry")
	require.Equal(t, "success", entry.Status)
	require.Equal(t, true, entry.Parameters["attachments_omitted"])
	require.EqualValues(t, 1, entry.Parameters["omitted_attachment_count"])
}

func TestGenerateFlaggedPostReportEvaluatesSessionAttributes(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.SessionAttributes = true
	}).InitBasic(t)

	client := th.Client
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	defer th.RemoveLicense(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	appErr := setBasicCommonReviewerConfig(th)
	require.Nil(t, appErr)

	session, appErr := th.App.GetSession(client.AuthToken)
	require.Nil(t, appErr)

	setVPNActive := func(t *testing.T, value string) {
		t.Helper()
		require.NoError(t, th.App.Srv().Store().SessionAttribute().Refresh(session.Id, map[string]any{
			model.SessionAttributesPropertyFieldVPNActive: value,
		}, model.GetMillis()))
	}

	// Stands in for a policy that grants the download only while the reviewer's session
	// reports an active VPN. Anything the PDP cannot match falls through to a denial, so
	// a subject built without session attributes shows up as stripped attachments.
	requireVPNActive := func(t *testing.T, channelID string) {
		t.Helper()

		mockACS := &mocks.AccessControlServiceInterface{}
		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionDownloadFileAttachment &&
				req.Resource.ID == channelID &&
				req.Subject.Session[model.SessionAttributesPropertyFieldVPNActive] == "true"
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil)).Maybe()
	}

	t.Run("Should include attachments when the session attribute satisfies the policy", func(t *testing.T) {
		post, fileInfo := uploadFileAndCreatePost(t, th, client)
		flagPostViaAPI(t, client, post.Id)
		setVPNActive(t, "true")
		requireVPNActive(t, post.ChannelId)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entries := readReportArchive(t, report)
		require.Contains(t, entries, "post/attachments/"+fileInfo.Id+"_"+fileInfo.Name)
		require.NotContains(t, entries, "ATTACHMENTS_OMITTED.txt")
	})

	t.Run("Should omit attachments when the session attribute fails the policy", func(t *testing.T) {
		post, fileInfo := uploadFileAndCreatePost(t, th, client)
		flagPostViaAPI(t, client, post.Id)
		setVPNActive(t, "false")
		requireVPNActive(t, post.ChannelId)

		report, resp, err := client.GenerateFlaggedPostReport(context.Background(), post.Id, &model.FlagContentActionRequest{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entries := readReportArchive(t, report)
		require.NotContains(t, entries, "post/attachments/"+fileInfo.Id+"_"+fileInfo.Name)
		require.Contains(t, entries, "ATTACHMENTS_OMITTED.txt")
	})
}
