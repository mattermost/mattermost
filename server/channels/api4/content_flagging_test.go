// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/stretchr/testify/require"
)

func setBasicCommonReviewerConfig(th *TestHelper) *model.AppError {
	config := model.ContentFlaggingSettingsRequest{
		ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
			EnableContentFlagging: model.NewPointer(true),
		},
		ReviewerSettings: &model.ReviewSettingsRequest{
			ReviewerSettings: model.ReviewerSettings{
				CommonReviewers: model.NewPointer(true),
			},
			ReviewerIDsSettings: model.ReviewerIDsSettings{
				CommonReviewerIds: []string{th.BasicUser.Id},
			},
		},
	}
	config.SetDefaults()
	return th.App.SaveContentFlaggingConfig(config)
}

func TestGetFlaggingConfiguration(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		status, resp, err := client.GetFlaggingConfiguration(context.Background())
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, status)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		status, resp, err := client.GetFlaggingConfiguration(context.Background())
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, status)
	})
}

func TestSaveContentFlaggingSettings(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 403 when user does not have manage system permission", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id},
				},
			},
		}

		// Use basic user who doesn't have manage system permission
		th.LoginBasic()
		resp, err := client.SaveContentFlaggingSettings(context.Background(), &config)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Should return 400 when config is invalid", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		// Invalid config - missing required fields
		config := model.ContentFlaggingSettingsRequest{
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers:       model.NewPointer(true),
					TeamAdminsAsReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{},
				},
			},
		}
		config.SetDefaults()

		th.LoginSystemAdmin()
		resp, err := th.SystemAdminClient.SaveContentFlaggingSettings(context.Background(), &config)
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Should successfully save content flagging settings when user has manage system permission", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id},
				},
			},
		}

		// Use system admin who has manage system permission
		resp, err := th.SystemAdminClient.SaveContentFlaggingSettings(context.Background(), &config)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestGetContentFlaggingSettings(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Should return 403 when user does not have manage system permission", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		// Use basic user who doesn't have manage system permission
		th.LoginBasic()
		settings, resp, err := th.Client.GetContentFlaggingSettings(context.Background())
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Nil(t, settings)
	})

	t.Run("Should successfully get content flagging settings when user has manage system permission", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		// First save some settings
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		// Use system admin who has manage system permission
		settings, resp, err := th.SystemAdminClient.GetContentFlaggingSettings(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotNil(t, settings)
		require.NotNil(t, settings.EnableContentFlagging)
		require.True(t, *settings.EnableContentFlagging)
		require.NotNil(t, settings.ReviewerSettings)
		require.NotNil(t, settings.ReviewerSettings.CommonReviewers)
		require.True(t, *settings.ReviewerSettings.CommonReviewers)
		require.NotNil(t, settings.ReviewerSettings.CommonReviewerIds)
		require.Contains(t, settings.ReviewerSettings.CommonReviewerIds, th.BasicUser.Id)
	})
}

func TestGetPostPropertyValues(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		propertyValues, resp, err := client.GetPostPropertyValues(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, propertyValues)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		propertyValues, resp, err := client.GetPostPropertyValues(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, propertyValues)
	})

	t.Run("Should return 404 when post does not exist", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		propertyValues, resp, err := client.GetPostPropertyValues(context.Background(), model.NewId())
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.Nil(t, propertyValues)
	})

	t.Run("Should return 403 when user is not a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		propertyValues, resp, err := client.GetPostPropertyValues(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Nil(t, propertyValues)
	})

	t.Run("Should successfully get property values when user is a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost()
		response, err := client.FlagPostForContentReview(context.Background(), post.Id, &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive content",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, response.StatusCode)

		// Now get the property values
		propertyValues, resp, err := client.GetPostPropertyValues(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotNil(t, propertyValues)
		require.Len(t, propertyValues, 6)
	})
}

func TestGetFlaggedPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should return 404 when post does not exist", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), model.NewId())
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should return 403 when user is not a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						th.BasicTeam.Id: {
							Enabled:     model.NewPointer(true),
							ReviewerIds: []string{}, // Empty list - user is not a reviewer
						},
					},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost()
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should return 404 when post is not flagged", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost()
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should successfully get flagged post when user is a reviewer and post is flagged", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost()

		// First flag the post
		flagRequest := &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive content",
		}
		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Now get the flagged post
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotNil(t, flaggedPost)
		require.Equal(t, post.Id, flaggedPost.Id)
	})

	t.Run("Should return flagged post's file info", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		data, err2 := testutils.ReadTestFile("test.png")
		require.NoError(t, err2)

		fileResponse, _, err := client.UploadFile(context.Background(), data, th.BasicChannel.Id, "test.png")
		require.NoError(t, err)
		require.Equal(t, 1, len(fileResponse.FileInfos))
		fileInfo := fileResponse.FileInfos[0]

		post := th.CreatePostInChannelWithFiles(th.BasicChannel, fileInfo)

		// First flag the post
		flagRequest := &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive content",
		}
		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, 1, len(flaggedPost.Metadata.Files))
		require.Equal(t, fileInfo.Id, flaggedPost.Metadata.Files[0].Id)
	})
}

func TestFlagPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		flagRequest := &model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		flagRequest := &model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("Should return 404 when post does not exist", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		flagRequest := &model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		resp, err := client.FlagPostForContentReview(context.Background(), model.NewId(), flagRequest)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Should return 403 when user does not have permission to view post", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		// Create a private channel and post
		privateChannel := th.CreatePrivateChannel()
		post := th.CreatePostWithClient(th.Client, privateChannel)
		th.RemoveUserFromChannel(th.BasicUser, privateChannel)

		flagRequest := &model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Should return 400 when content flagging is not enabled for the team", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						th.BasicTeam.Id: {Enabled: model.NewPointer(false)},
					},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost()
		flagRequest := &model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Should successfully flag a post when all conditions are met", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost()
		flagRequest := &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive data",
		}

		resp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestGetTeamPostReportingFeatureStatus(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		status, resp, err := client.GetTeamPostFlaggingFeatureStatus(context.Background(), model.NewId())
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, status)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		status, resp, err := client.GetTeamPostFlaggingFeatureStatus(context.Background(), model.NewId())
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, status)
	})

	t.Run("Should return Forbidden error when calling for a team without the team membership", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{"reviewer_user_id_1", "reviewer_user_id_2"},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// using basic user because the default user is a system admin, and they have
		// access to all teams even without being an explicit team member
		th.LoginBasic()
		team := th.CreateTeam()
		// unlinking from the created team as by default the team's creator is
		// a team member, so we need to leave the team explicitly
		th.UnlinkUserFromTeam(th.BasicUser, team)

		status, resp, err := client.GetTeamPostFlaggingFeatureStatus(context.Background(), team.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Nil(t, status)

		// now we will join the team and that will allow us to call the endpoint without error
		th.LinkUserToTeam(th.BasicUser, team)
		status, resp, err = client.GetTeamPostFlaggingFeatureStatus(context.Background(), team.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.True(t, status["enabled"])
	})
}

func TestSearchReviewers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		reviewers, resp, err := client.SearchContentFlaggingReviewers(context.Background(), th.BasicTeam.Id, "test")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, reviewers)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		reviewers, resp, err := client.SearchContentFlaggingReviewers(context.Background(), th.BasicTeam.Id, "test")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		require.Nil(t, reviewers)
	})

	t.Run("Should return 403 when user is not a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						th.BasicTeam.Id: {
							Enabled:     model.NewPointer(true),
							ReviewerIds: []string{}, // Empty list - user is not a reviewer
						},
					},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		reviewers, resp, err := client.SearchContentFlaggingReviewers(context.Background(), th.BasicTeam.Id, "test")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Nil(t, reviewers)
	})

	t.Run("Should successfully search reviewers when user is a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		reviewers, resp, err := client.SearchContentFlaggingReviewers(context.Background(), th.BasicTeam.Id, "basic")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotNil(t, reviewers)
	})

	t.Run("Should successfully search reviewers when user is a team reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						th.BasicTeam.Id: {
							Enabled:     model.NewPointer(true),
							ReviewerIds: []string{th.BasicUser.Id},
						},
					},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		reviewers, resp, err := client.SearchContentFlaggingReviewers(context.Background(), th.BasicTeam.Id, "basic")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NotNil(t, reviewers)
	})
}

func TestAssignContentFlaggingReviewer(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client

	t.Run("Should return 501 when Enterprise Advanced license is not present even if feature is enabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, th.BasicUser.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("Should return 501 when feature is disabled", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(false)
			config.ContentFlaggingSettings.SetDefaults()
		})

		post := th.CreatePost()
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, th.BasicUser.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("Should return 404 when post does not exist", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
		})

		resp, err := client.AssignContentFlaggingReviewer(context.Background(), model.NewId(), th.BasicUser.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Should return 400 when user ID is invalid", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		appErr := setBasicCommonReviewerConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost()
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, "invalidUserId")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Should return 403 when assigning user is not a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						th.BasicTeam.Id: {
							Enabled:     model.NewPointer(true),
							ReviewerIds: []string{}, // Empty list - user is not a reviewer
						},
					},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost()
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, th.BasicUser.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Should return 400 when assignee is not a reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		// Create another user who will not be a reviewer
		nonReviewerUser := th.CreateUser()
		th.LinkUserToTeam(nonReviewerUser, th.BasicTeam)

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id}, // Only BasicUser is a reviewer
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost()
		// Try to assign non-reviewer user
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, nonReviewerUser.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Should successfully assign reviewer when all conditions are met", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		// Create another reviewer user
		reviewerUser := th.CreateUser()
		th.LinkUserToTeam(reviewerUser, th.BasicTeam)

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id, reviewerUser.Id},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost()

		// First flag the post so it can be assigned
		flagRequest := &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive content",
		}
		flagResp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, flagResp.StatusCode)

		// Now assign the reviewer
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, reviewerUser.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Should successfully assign reviewer when user is team reviewer", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense()

		// Create another reviewer user
		reviewerUser := th.CreateUser()
		th.LinkUserToTeam(reviewerUser, th.BasicTeam)

		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						th.BasicTeam.Id: {
							Enabled:     model.NewPointer(true),
							ReviewerIds: []string{th.BasicUser.Id, reviewerUser.Id},
						},
					},
				},
			},
		}
		config.SetDefaults()
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost()

		// First flag the post so it can be assigned
		flagRequest := &model.FlagContentRequest{
			Reason:  "Sensitive data",
			Comment: "This is sensitive content",
		}
		flagResp, err := client.FlagPostForContentReview(context.Background(), post.Id, flagRequest)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, flagResp.StatusCode)

		// Now assign the reviewer
		resp, err := client.AssignContentFlaggingReviewer(context.Background(), post.Id, reviewerUser.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
