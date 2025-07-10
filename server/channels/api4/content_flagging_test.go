// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetReportingConfiguration(t *testing.T) {
	mainHelper.Parallel(t)
	os.Setenv("MM_FEATUREFLAGS_ContentFlagging", "true")
	th := Setup(t).InitBasic()
	defer func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ContentFlagging")
	}()

	setupContentFlagging := func() {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.FeatureFlags.ContentFlagging = true
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})
	}

	client := th.Client

	t.Run("should return reporting configuration", func(t *testing.T) {
		setupContentFlagging()

		config, resp, err := client.GetReportingConfiguration(context.Background())
		require.NotNil(t, config)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, 5, len(*config.Reasons), "Expected 5 default reasons in the reporting configuration")
		require.True(t, *config.ReporterCommentRequired)
	})

	t.Run("should return 501 when content flagging is not enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.FeatureFlags.ContentFlagging = false
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
		})

		_, resp, err := client.GetReportingConfiguration(context.Background())
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("should return 501 when license is not enterprise advanced", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		th.App.UpdateConfig(func(config *model.Config) {
			config.FeatureFlags.ContentFlagging = true
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
		})

		_, resp, err := client.GetReportingConfiguration(context.Background())
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("should work for guest users", func(t *testing.T) {
		setupContentFlagging()

		th.App.UpdateConfig(func(config *model.Config) {
			config.GuestAccountsSettings.Enable = model.NewPointer(true)
		})

		_, guestClient := th.CreateGuestAndClient(t)
		config, resp, err := guestClient.GetReportingConfiguration(context.Background())
		require.NotNil(t, config)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, 5, len(*config.Reasons), "Expected 5 default reasons in the reporting configuration")
		require.True(t, *config.ReporterCommentRequired)
	})
}

func TestGetTeamPostReportingFeatureStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	setupContentFlagging := func() {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.FeatureFlags.ContentFlagging = true
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})
	}

	client := th.Client

	basicTeam2 := th.CreateTeam()

	t.Run("should return enabled status for team with common reviewers", func(t *testing.T) {
		setupContentFlagging()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		})

		status, resp, err := client.GetTeamPostReportingFeatureStatus(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, status["enabled"])
	})

	t.Run("should return enabled status for team with specific reviewers", func(t *testing.T) {
		setupContentFlagging()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{th.BasicUser.Id}),
				},
			}
		})

		status, resp, err := client.GetTeamPostReportingFeatureStatus(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, status["enabled"])

		status, resp, err = client.GetTeamPostReportingFeatureStatus(context.Background(), basicTeam2.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.False(t, status["enabled"])
	})

	t.Run("should return disabled status for team without reviewers", func(t *testing.T) {
		setupContentFlagging()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(false),
					ReviewerIds: model.NewPointer([]string{}),
				},
			}
		})

		status, resp, err := client.GetTeamPostReportingFeatureStatus(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.False(t, status["enabled"])
	})

	t.Run("should return enabled status with additional reviewers", func(t *testing.T) {
		setupContentFlagging()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{}),
				},
			}
			config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		})

		status, resp, err := client.GetTeamPostReportingFeatureStatus(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, status["enabled"])

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
			config.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		status, resp, err = client.GetTeamPostReportingFeatureStatus(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, status["enabled"])

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		status, resp, err = client.GetTeamPostReportingFeatureStatus(context.Background(), th.BasicTeam.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, status["enabled"])
	})
}
