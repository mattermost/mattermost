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
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
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

	t.Run("Should return 400 when the post has already been retained", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		resp, err := client.KeepFlaggedPost(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "looks fine"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		require.Empty(t, report)
	})

	t.Run("Should return 400 when the post has already been removed", func(t *testing.T) {
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t)
		flagPostViaAPI(t, client, post.Id)

		resp, err := client.RemoveFlaggedPost(context.Background(), post.Id, &model.FlagContentActionRequest{Comment: "confirmed spillage"})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		report, resp, err := client.GeneratePostExposureReport(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		require.Empty(t, report)
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

		// BasicUser2 is the assignee, so the Assigned status is still actionable.
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
