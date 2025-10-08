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

func TestGetFlaggingConfiguration(t *testing.T) {
	mainHelper.Parallel(t)

	os.Setenv("MM_FEATUREFLAGS_ContentFlagging", "true")
	th := Setup(t)
	defer func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ContentFlagging")
	}()

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

func TestGetPostPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)

	os.Setenv("MM_FEATUREFLAGS_ContentFlagging", "true")
	th := Setup(t).InitBasic()
	defer func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ContentFlagging")
	}()

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
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

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
		require.Len(t, propertyValues, 5)
	})
}

func TestGetFlaggedPost(t *testing.T) {
	mainHelper.Parallel(t)

	os.Setenv("MM_FEATUREFLAGS_ContentFlagging", "true")
	th := Setup(t).InitBasic()
	defer func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ContentFlagging")
	}()

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
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			// Set up config so user is not a reviewer
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{}
			(*config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting)[th.BasicTeam.Id] = model.TeamReviewerSetting{
				Enabled:     model.NewPointer(true),
				ReviewerIds: &[]string{}, // Empty list - user is not a reviewer
			}
		})

		post := th.CreatePost()
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should return 404 when post is not flagged", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

		post := th.CreatePost()
		flaggedPost, resp, err := client.GetContentFlaggedPost(context.Background(), post.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.Nil(t, flaggedPost)
	})

	t.Run("Should successfully get flagged post when user is a reviewer and post is flagged", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

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
}

func TestFlagPost(t *testing.T) {
	mainHelper.Parallel(t)

	os.Setenv("MM_FEATUREFLAGS_ContentFlagging", "true")
	th := Setup(t).InitBasic()
	defer func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ContentFlagging")
	}()

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

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			// Set up config so content flagging is not enabled for this team
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{}
			(*config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting)[th.BasicTeam.Id] = model.TeamReviewerSetting{Enabled: model.NewPointer(false)}
		})

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

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

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
	mainHelper.Parallel(t)

	os.Setenv("MM_FEATUREFLAGS_ContentFlagging", "true")
	th := Setup(t)
	defer func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ContentFlagging")
	}()

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

		th.App.UpdateConfig(func(config *model.Config) {
			config.ContentFlaggingSettings.EnableContentFlagging = model.NewPointer(true)
			config.ContentFlaggingSettings.SetDefaults()
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{"reviewer_user_id_1", "reviewer_user_id_2"}
		})

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
