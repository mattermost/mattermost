// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func getBaseConfig(th *TestHelper) model.ContentFlaggingSettingsRequest {
	config := model.ContentFlaggingSettingsRequest{}
	config.SetDefaults()
	config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
	config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
	config.ReviewerSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
	config.ReviewerSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
	config.AdditionalSettings.ReporterCommentRequired = model.NewPointer(false)
	config.AdditionalSettings.HideFlaggedContent = model.NewPointer(false)
	config.AdditionalSettings.Reasons = &[]string{"spam", "harassment", "inappropriate"}
	return config
}

func setBaseConfig(th *TestHelper) *model.AppError {
	appErr := th.App.SaveContentFlaggingConfig(getBaseConfig(th))
	if appErr != nil {
		return appErr
	}

	return nil
}

func setupFlaggedPost(th *TestHelper) (*model.Post, *model.AppError) {
	post := th.CreatePost(th.BasicChannel)

	flagData := model.FlagContentRequest{
		Reason:  "spam",
		Comment: "This is spam content",
	}

	appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
	if appErr != nil {
		return nil, appErr
	}

	time.Sleep(2 * time.Second)

	return post, nil
}

func TestContentFlaggingEnabledForTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	t.Run("should return true for common reviewers", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
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

		status, appErr := th.App.ContentFlaggingEnabledForTeam("team1")
		require.Nil(t, appErr)
		require.True(t, status, "expected team post reporting feature to be enabled for common reviewers")
	})

	t.Run("should return true when configured for specified team", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						"team1": {
							Enabled:     model.NewPointer(true),
							ReviewerIds: []string{"reviewer_user_id_1"},
						},
					},
				},
			},
		}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		status, appErr := th.App.ContentFlaggingEnabledForTeam("team1")
		require.Nil(t, appErr)
		require.True(t, status, "expected team post reporting feature to be disabled for team without reviewers")
	})

	t.Run("should return true when using Additional Reviewers", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers:       model.NewPointer(false),
					TeamAdminsAsReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					TeamReviewersSetting: map[string]*model.TeamReviewerSetting{
						"team1": {
							Enabled: model.NewPointer(true),
						},
					},
				},
			},
		}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		status, appErr := th.App.ContentFlaggingEnabledForTeam("team1")
		require.Nil(t, appErr)
		require.True(t, status)

		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		appErr = th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		status, appErr = th.App.ContentFlaggingEnabledForTeam("team1")
		require.Nil(t, appErr)
		require.True(t, status)

		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		appErr = th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		status, appErr = th.App.ContentFlaggingEnabledForTeam("team1")
		require.Nil(t, appErr)
		require.True(t, status)
	})

	t.Run("should return true for default state", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		status, appErr := th.App.ContentFlaggingEnabledForTeam("team1")
		require.Nil(t, appErr)
		require.True(t, status, "expected team post reporting feature to be enabled for common reviewers")
	})
}

func TestAssignFlaggedPostReviewer(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should successfully assign reviewer to pending flagged post", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		// Verify status was updated to assigned
		statusValue, appErr := th.App.GetPostContentFlaggingStatusValue(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, `"`+model.ContentFlaggingStatusAssigned+`"`, string(statusValue.Value))

		// Verify reviewer property was created
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		reviewerValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReviewerUserID].ID,
		})
		require.NoError(t, err)
		require.Len(t, reviewerValues, 1)
		require.Equal(t, `"`+th.BasicUser.Id+`"`, string(reviewerValues[0].Value))
	})

	t.Run("should successfully reassign reviewer to already assigned flagged post", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		// First assignment
		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		// Second assignment (reassignment)
		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser2.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		// Verify status remains assigned
		statusValue, appErr := th.App.GetPostContentFlaggingStatusValue(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, `"`+model.ContentFlaggingStatusAssigned+`"`, string(statusValue.Value))

		// Verify reviewer property was updated
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		reviewerValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReviewerUserID].ID,
		})
		require.NoError(t, err)
		require.Len(t, reviewerValues, 1)
		require.Equal(t, `"`+th.BasicUser2.Id+`"`, string(reviewerValues[0].Value))
	})

	t.Run("should fail when trying to assign reviewer to non-flagged post", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))
		post := th.CreatePost(th.BasicChannel)

		appErr := th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("should fail when trying to assign reviewer to retained post", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		// First retain the post
		actionRequest := &model.FlagContentActionRequest{
			Comment: "Keeping this post",
		}
		appErr = th.App.KeepFlaggedPost(th.Context, actionRequest, th.BasicUser.Id, post)
		require.Nil(t, appErr)

		// Try to assign reviewer to retained post
		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser2.Id, th.SystemAdminUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "api.content_flagging.error.post_not_in_progress", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should fail when trying to assign reviewer to removed post", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		// First remove the post
		actionRequest := &model.FlagContentActionRequest{
			Comment: "Removing this post",
		}
		appErr = th.App.PermanentDeleteFlaggedPost(th.Context, actionRequest, th.BasicUser.Id, post)
		require.Nil(t, appErr)

		// Try to assign reviewer to removed post
		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser2.Id, th.SystemAdminUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "api.content_flagging.error.post_not_in_progress", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should handle assignment with same reviewer ID", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		// Assign reviewer
		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		// Assign same reviewer again
		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		// Verify status remains assigned
		statusValue, appErr := th.App.GetPostContentFlaggingStatusValue(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, `"`+model.ContentFlaggingStatusAssigned+`"`, string(statusValue.Value))

		// Verify reviewer property still exists with correct value
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		reviewerValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReviewerUserID].ID,
		})
		require.NoError(t, err)
		require.Len(t, reviewerValues, 1)
		require.Equal(t, `"`+th.BasicUser.Id+`"`, string(reviewerValues[0].Value))
	})

	t.Run("should handle assignment with empty reviewer ID", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		appErr = th.App.AssignFlaggedPostReviewer(th.Context, post.Id, th.BasicChannel.TeamId, "", th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		// Verify status was updated to assigned
		statusValue, appErr := th.App.GetPostContentFlaggingStatusValue(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, `"`+model.ContentFlaggingStatusAssigned+`"`, string(statusValue.Value))

		// Verify reviewer property was created with empty value
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		reviewerValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReviewerUserID].ID,
		})
		require.NoError(t, err)
		require.Len(t, reviewerValues, 1)
		require.Equal(t, `""`, string(reviewerValues[0].Value))
	})

	t.Run("should handle assignment with invalid post ID", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))
		appErr := th.App.AssignFlaggedPostReviewer(th.Context, "invalid_post_id", th.BasicChannel.TeamId, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestSaveContentFlaggingConfig(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should save content flagging config successfully", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
				AdditionalSettings: &model.AdditionalContentFlaggingSettings{
					ReporterCommentRequired: model.NewPointer(true),
					HideFlaggedContent:      model.NewPointer(false),
					Reasons:                 &[]string{"spam", "harassment", "inappropriate"},
				},
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers:         model.NewPointer(true),
					SystemAdminsAsReviewers: model.NewPointer(true),
					TeamAdminsAsReviewers:   model.NewPointer(false),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id, th.BasicUser2.Id},
				},
			},
		}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Verify system config was updated
		savedConfig := th.App.Config()
		require.Equal(t, *config.EnableContentFlagging, *savedConfig.ContentFlaggingSettings.EnableContentFlagging)
		require.Equal(t, *config.ReviewerSettings.CommonReviewers, *savedConfig.ContentFlaggingSettings.ReviewerSettings.CommonReviewers)
		require.Equal(t, *config.ReviewerSettings.SystemAdminsAsReviewers, *savedConfig.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers)
		require.Equal(t, *config.ReviewerSettings.TeamAdminsAsReviewers, *savedConfig.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers)
		require.Equal(t, *config.AdditionalSettings.ReporterCommentRequired, *savedConfig.ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired)
		require.Equal(t, *config.AdditionalSettings.HideFlaggedContent, *savedConfig.ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent)
		require.Equal(t, *config.AdditionalSettings.Reasons, *savedConfig.ContentFlaggingSettings.AdditionalSettings.Reasons)

		// Verify reviewer IDs were saved separately
		reviewerIDs, appErr := th.App.GetContentFlaggingConfigReviewerIDs()
		require.Nil(t, appErr)
		require.Equal(t, config.ReviewerSettings.CommonReviewerIds, reviewerIDs.CommonReviewerIds)
	})

	t.Run("should save config with team reviewers", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: model.ContentFlaggingSettingsBase{
				EnableContentFlagging: model.NewPointer(true),
			},
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers:         model.NewPointer(false),
					SystemAdminsAsReviewers: model.NewPointer(false),
					TeamAdminsAsReviewers:   model.NewPointer(false),
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

		// Verify team reviewers were saved
		reviewerIDs, appErr := th.App.GetContentFlaggingConfigReviewerIDs()
		require.Nil(t, appErr)
		require.NotNil(t, reviewerIDs.TeamReviewersSetting)

		teamSettings := (reviewerIDs.TeamReviewersSetting)[th.BasicTeam.Id]
		require.True(t, *teamSettings.Enabled)
		require.Equal(t, []string{th.BasicUser.Id}, teamSettings.ReviewerIds)
	})

	t.Run("should handle empty config", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Verify defaults were applied
		savedConfig := th.App.Config()
		require.NotNil(t, savedConfig.ContentFlaggingSettings.EnableContentFlagging)
		require.NotNil(t, savedConfig.ContentFlaggingSettings.ReviewerSettings.CommonReviewers)
	})
}

func TestGetContentFlaggingConfigReviewerIDs(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should return reviewer IDs after saving config", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					CommonReviewers: model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id, th.BasicUser2.Id},
				},
			},
		}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		reviewerIDs, appErr := th.App.GetContentFlaggingConfigReviewerIDs()
		require.Nil(t, appErr)
		require.NotNil(t, reviewerIDs)
		require.Equal(t, []string{th.BasicUser.Id, th.BasicUser2.Id}, reviewerIDs.CommonReviewerIds)
	})

	t.Run("should return team reviewer settings", func(t *testing.T) {
		config := model.ContentFlaggingSettingsRequest{
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
						"team2": {
							Enabled:     model.NewPointer(false),
							ReviewerIds: []string{th.BasicUser2.Id},
						},
					},
				},
			},
		}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		reviewerIDs, appErr := th.App.GetContentFlaggingConfigReviewerIDs()
		require.Nil(t, appErr)
		require.NotNil(t, reviewerIDs.TeamReviewersSetting)

		teamSettings := reviewerIDs.TeamReviewersSetting
		require.Len(t, teamSettings, 2)

		// Check first team
		team1Settings := teamSettings[th.BasicTeam.Id]
		require.True(t, *team1Settings.Enabled)
		require.Equal(t, []string{th.BasicUser.Id}, team1Settings.ReviewerIds)

		// Check second team
		team2Settings := teamSettings["team2"]
		require.False(t, *team2Settings.Enabled)
		require.Equal(t, []string{th.BasicUser2.Id}, team2Settings.ReviewerIds)
	})

	t.Run("should return empty settings when no config saved", func(t *testing.T) {
		// Clear any existing config by saving empty config
		config := model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		reviewerIDs, appErr := th.App.GetContentFlaggingConfigReviewerIDs()
		require.Nil(t, appErr)
		require.NotNil(t, reviewerIDs)

		// Should have default empty values
		if reviewerIDs.CommonReviewerIds != nil {
			require.Empty(t, reviewerIDs.CommonReviewerIds)
		}
		if reviewerIDs.TeamReviewersSetting != nil {
			require.Empty(t, reviewerIDs.TeamReviewersSetting)
		}
	})
}

func TestGetContentReviewChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	getBaseConfig := func() model.ContentFlaggingSettingsRequest {
		config := model.ContentFlaggingSettingsRequest{
			ReviewerSettings: &model.ReviewSettingsRequest{
				ReviewerSettings: model.ReviewerSettings{
					TeamAdminsAsReviewers:   model.NewPointer(true),
					SystemAdminsAsReviewers: model.NewPointer(true),
					CommonReviewers:         model.NewPointer(true),
				},
				ReviewerIDsSettings: model.ReviewerIDsSettings{
					CommonReviewerIds: []string{th.BasicUser.Id, th.BasicUser2.Id},
				},
			},
		}
		config.SetDefaults()
		return config
	}

	t.Run("should return channels for common reviewers", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 2)

		for _, channel := range channels {
			require.Equal(t, model.ChannelTypeDirect, channel.Type)
			otherUserId := channel.GetOtherUserIdForDM(contentReviewBot.UserId)
			require.True(t, otherUserId == th.BasicUser.Id || otherUserId == th.BasicUser2.Id)
		}
	})

	t.Run("should return channels for system admins as additional reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Sysadmin explicitly need to be a team member to be returned as reviewer
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		defer func() {
			_ = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		}()

		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 3)

		require.Equal(t, model.ChannelTypeDirect, channels[0].Type)
		require.Equal(t, model.ChannelTypeDirect, channels[1].Type)
		require.Equal(t, model.ChannelTypeDirect, channels[2].Type)

		reviewerIds := []string{
			channels[0].GetOtherUserIdForDM(contentReviewBot.UserId),
			channels[1].GetOtherUserIdForDM(contentReviewBot.UserId),
			channels[2].GetOtherUserIdForDM(contentReviewBot.UserId),
		}
		require.Contains(t, reviewerIds, th.BasicUser.Id)
		require.Contains(t, reviewerIds, th.BasicUser2.Id)
		require.Contains(t, reviewerIds, th.SystemAdminUser.Id)
	})

	t.Run("should return channels for team admins as additional reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Create a new user and make them team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")

		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 3)

		require.Equal(t, model.ChannelTypeDirect, channels[0].Type)
		require.Equal(t, model.ChannelTypeDirect, channels[1].Type)
		require.Equal(t, model.ChannelTypeDirect, channels[2].Type)

		reviewerIds := []string{
			channels[0].GetOtherUserIdForDM(contentReviewBot.UserId),
			channels[1].GetOtherUserIdForDM(contentReviewBot.UserId),
			channels[2].GetOtherUserIdForDM(contentReviewBot.UserId),
		}
		require.Contains(t, reviewerIds, th.BasicUser.Id)
		require.Contains(t, reviewerIds, th.BasicUser2.Id)
		require.Contains(t, reviewerIds, teamAdmin.Id)
	})

	t.Run("should return channels for team reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}

		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)

		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(true),
				ReviewerIds: []string{th.BasicUser2.Id},
			},
		}
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 1)

		require.Equal(t, model.ChannelTypeDirect, channels[0].Type)
		otherUserId := channels[0].GetOtherUserIdForDM(contentReviewBot.UserId)
		require.Equal(t, th.BasicUser2.Id, otherUserId)
	})

	t.Run("should not return channels for team reviewers when disabled for the team", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(false),
				ReviewerIds: []string{th.BasicUser.Id},
			},
		}
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 0)
	})

	t.Run("should return channels for additional reviewers with team reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)

		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(true),
				ReviewerIds: []string{th.BasicUser2.Id},
			},
		}
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		defer func() {
			_ = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		}()
		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 2)

		reviewerIds := []string{
			channels[0].GetOtherUserIdForDM(contentReviewBot.UserId),
			channels[1].GetOtherUserIdForDM(contentReviewBot.UserId),
		}

		require.Contains(t, reviewerIds, th.BasicUser2.Id)
		require.Contains(t, reviewerIds, th.SystemAdminUser.Id)
	})
}

func TestGetReviewersForTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should return common reviewers", func(t *testing.T) {
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id, th.BasicUser2.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, th.BasicUser2.Id)
	})

	t.Run("should return system admins as additional reviewers", func(t *testing.T) {
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		// Sysadmin explicitly need to be a team member to be returned as reviewer
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)

		config.ReviewerSettings.CommonReviewerIds = []string{}
		appErr = th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)

		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		appErr = th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		// If sysadmin is not a team member, they should not be returned as a reviewer
		appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.BasicUser.Id)
	})

	t.Run("should return team admins as additional reviewers", func(t *testing.T) {
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		// Create a new user and make them team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, teamAdmin.Id)

		config.ReviewerSettings.CommonReviewerIds = []string{}
		appErr = th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, teamAdmin.Id)

		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		appErr = th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		// If team admin is not a team member, they should not be returned as a reviewer
		appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.BasicUser.Id)
	})

	t.Run("should return team reviewers", func(t *testing.T) {
		team2 := th.CreateTeam()
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(true),
				ReviewerIds: []string{th.BasicUser2.Id},
			},
		}

		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		// Reviewers configured for th.BasicTeam
		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.BasicUser2.Id)

		// NO reviewers configured for team2
		reviewers, appErr = th.App.getReviewersForTeam(team2.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 0)
	})

	t.Run("should not return reviewers when disabled for the team", func(t *testing.T) {
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(false),
				ReviewerIds: []string{th.BasicUser.Id},
			},
		}

		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 0)
	})

	t.Run("should return additional reviewers with team reviewers", func(t *testing.T) {
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(true),
				ReviewerIds: []string{th.BasicUser2.Id},
			},
		}
		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser2.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)
	})

	t.Run("should return unique reviewers", func(t *testing.T) {
		config := &model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id, th.SystemAdminUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		appErr := th.App.SaveContentFlaggingConfig(*config)
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)
	})
}

func TestCanFlagPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should be able to flag post which has not already been flagged", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		appErr = th.App.canFlagPost(groupId, post.Id, "en")
		require.Nil(t, appErr)
	})

	t.Run("should not be able to flag post which has already been flagged", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		statusField, err := th.Server.propertyService.GetPropertyFieldByName(groupId, "", contentFlaggingPropertyNameStatus)
		require.NoError(t, err)

		propertyValue, err := th.Server.propertyService.CreatePropertyValue(&model.PropertyValue{
			TargetID:   post.Id,
			GroupID:    groupId,
			FieldID:    statusField.ID,
			TargetType: "post",
			Value:      json.RawMessage(`"` + model.ContentFlaggingStatusPending + `"`),
		})
		require.NoError(t, err)

		// Can't fleg when post already flagged in pending status
		appErr = th.App.canFlagPost(groupId, post.Id, "en")
		require.NotNil(t, appErr)
		require.Equal(t, "Cannot flag this post as is already flagged.", appErr.Id)

		// Can't fleg when post already flagged in assigned status
		propertyValue.Value = json.RawMessage(`"` + model.ContentFlaggingStatusAssigned + `"`)
		_, err = th.Server.propertyService.UpdatePropertyValue(groupId, propertyValue)
		require.NoError(t, err)

		appErr = th.App.canFlagPost(groupId, post.Id, "en")
		require.NotNil(t, appErr)

		// Can't fleg when post already flagged in retained status
		propertyValue.Value = json.RawMessage(`"` + model.ContentFlaggingStatusRetained + `"`)
		_, err = th.Server.propertyService.UpdatePropertyValue(groupId, propertyValue)
		require.NoError(t, err)

		appErr = th.App.canFlagPost(groupId, post.Id, "en")
		require.NotNil(t, appErr)

		// Can't fleg when post already flagged in removed status
		propertyValue.Value = json.RawMessage(`"` + model.ContentFlaggingStatusRemoved + `"`)
		_, err = th.Server.propertyService.UpdatePropertyValue(groupId, propertyValue)
		require.NoError(t, err)

		appErr = th.App.canFlagPost(groupId, post.Id, "en")
		require.NotNil(t, appErr)
	})
}

func TestFlagPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	getBaseConfig := func() model.ContentFlaggingSettingsRequest {
		cfg := model.ContentFlaggingSettingsRequest{}
		cfg.SetDefaults()
		cfg.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		cfg.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		cfg.AdditionalSettings.ReporterCommentRequired = model.NewPointer(false)
		cfg.AdditionalSettings.HideFlaggedContent = model.NewPointer(false)
		cfg.AdditionalSettings.Reasons = &[]string{"spam", "harassment", "inappropriate"}
		return cfg
	}

	t.Run("should successfully flag a post with valid data", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Verify property values were created
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		// Check status property
		statusValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameStatus].ID,
		})
		require.NoError(t, err)
		require.Len(t, statusValues, 1)
		require.Equal(t, `"`+model.ContentFlaggingStatusPending+`"`, string(statusValues[0].Value))

		// Check reporting user property
		userValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReportingUserID].ID,
		})
		require.NoError(t, err)
		require.Len(t, userValues, 1)
		require.Equal(t, `"`+th.BasicUser2.Id+`"`, string(userValues[0].Value))

		// Check reason property
		reasonValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReportingReason].ID,
		})
		require.NoError(t, err)
		require.Len(t, reasonValues, 1)
		require.Equal(t, `"spam"`, string(reasonValues[0].Value))

		// Check comment property
		commentValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReportingComment].ID,
		})
		require.NoError(t, err)
		require.Len(t, commentValues, 1)
		require.Equal(t, `"This is spam content"`, string(commentValues[0].Value))
	})

	t.Run("should fail with invalid reason", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "invalid_reason",
			Comment: "This is spam content",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.NotNil(t, appErr)
		require.Equal(t, "api.content_flagging.error.reason_invalid", appErr.Id)
	})

	t.Run("should fail when comment is required but not provided", func(t *testing.T) {
		config := getBaseConfig()
		config.AdditionalSettings.ReporterCommentRequired = model.NewPointer(true)
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.NotNil(t, appErr)
	})

	t.Run("should fail when trying to flag already flagged post", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"This is spam content\"",
		}

		// Flag the post first time
		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Try to flag the same post again
		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.NotNil(t, appErr)
		require.Equal(t, "Cannot flag this post as is already flagged.", appErr.Id)
	})

	t.Run("should hide flagged content when configured", func(t *testing.T) {
		config := getBaseConfig()
		config.AdditionalSettings.HideFlaggedContent = model.NewPointer(true)
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"This is spam content\"",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Verify post was deleted
		deletedPost, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
		require.NotNil(t, appErr)
		require.Nil(t, deletedPost)
	})

	t.Run("should create content review post for reviewers", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "harassment",
			Comment: "\"This is harassment\"",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)

		require.Nil(t, appErr)

		// The reviewer posts are created async in a go routine. Wait for a short time to allow it to complete.
		// 2 seconds is the minimum time when the test consistently passes locally and in CI.
		time.Sleep(5 * time.Second)

		// Get the content review bot
		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		// Get direct channel between reviewer and bot
		dmChannel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)

		// Check if review post was created in the DM channel
		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: dmChannel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		require.NotEmpty(t, posts.Posts)

		// Find the content review post
		var reviewPost *model.Post
		for _, p := range posts.Posts {
			if p.Type == "custom_spillage_report" {
				reviewPost = p
				break
			}
		}
		require.NotNil(t, reviewPost)
	})

	t.Run("should work with empty comment when not required", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "inappropriate",
			Comment: "",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Verify property values were created with empty comment
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		commentValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReportingComment].ID,
		})
		require.NoError(t, err)
		require.Len(t, commentValues, 1)
		require.Equal(t, `""`, string(commentValues[0].Value))
	})

	t.Run("should set reporting time property", func(t *testing.T) {
		appErr := th.App.SaveContentFlaggingConfig(getBaseConfig())
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"Test comment\"",
		}

		beforeTime := model.GetMillis()
		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)

		afterTime := model.GetMillis()
		require.Nil(t, appErr)

		// Verify reporting time property was set
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		timeValues, err := th.Server.propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			PerPage:   CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID:   mappedFields[contentFlaggingPropertyNameReportingTime].ID,
		})
		require.NoError(t, err)
		require.Len(t, timeValues, 1)

		var reportingTime int64
		err = json.Unmarshal(timeValues[0].Value, &reportingTime)
		require.NoError(t, err)
		require.True(t, reportingTime >= beforeTime && reportingTime <= afterTime)
	})
}

func TestSearchReviewers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	getBaseConfig := func() model.ContentFlaggingSettingsRequest {
		config := model.ContentFlaggingSettingsRequest{}
		config.SetDefaults()
		return config
	}

	t.Run("should return common reviewers when searching", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id, th.BasicUser2.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Search for users by username
		reviewers, appErr := th.App.SearchReviewers(th.Context, th.BasicUser.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Equal(t, th.BasicUser.Id, reviewers[0].Id)

		// Search for users by partial username
		reviewers, appErr = th.App.SearchReviewers(th.Context, th.BasicUser.Username[:3], th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.True(t, len(reviewers) >= 1)

		// Verify the basic user is in the results
		found := false
		for _, reviewer := range reviewers {
			if reviewer.Id == th.BasicUser.Id {
				found = true
				break
			}
		}
		require.True(t, found)
	})

	t.Run("should return team reviewers when common reviewers disabled", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(true),
				ReviewerIds: []string{th.BasicUser2.Id},
			},
		}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Search for team reviewer
		reviewers, appErr := th.App.SearchReviewers(th.Context, th.BasicUser2.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Equal(t, th.BasicUser2.Id, reviewers[0].Id)

		// Search should not return users not configured as team reviewers
		reviewers, appErr = th.App.SearchReviewers(th.Context, th.BasicUser.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 0)
	})

	t.Run("should return system admins as additional reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Add system admin to team
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		defer func() {
			_ = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		}()

		// Search for system admin
		reviewers, appErr := th.App.SearchReviewers(th.Context, th.SystemAdminUser.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Equal(t, th.SystemAdminUser.Id, reviewers[0].Id)
	})

	t.Run("should return team admins as additional reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Create a new user and make them team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		// Search for team admin
		reviewers, appErr := th.App.SearchReviewers(th.Context, teamAdmin.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Equal(t, teamAdmin.Id, reviewers[0].Id)
	})

	t.Run("should return combined reviewers from multiple sources", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Add system admin to team
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		defer func() {
			_ = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		}()

		// Create a team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		// Search with empty term should return all reviewers
		reviewers, appErr := th.App.SearchReviewers(th.Context, "", th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.True(t, len(reviewers) >= 3)

		// Verify all expected reviewers are present
		reviewerIds := make([]string, len(reviewers))
		for i, reviewer := range reviewers {
			reviewerIds[i] = reviewer.Id
		}
		require.Contains(t, reviewerIds, th.BasicUser.Id)
		require.Contains(t, reviewerIds, th.SystemAdminUser.Id)
		require.Contains(t, reviewerIds, teamAdmin.Id)
	})

	t.Run("should deduplicate reviewers from multiple sources", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.SystemAdminUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Add system admin to team
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		defer func() {
			_ = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		}()

		// Search for system admin (who is both common reviewer and system admin)
		reviewers, appErr := th.App.SearchReviewers(th.Context, th.SystemAdminUser.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Equal(t, th.SystemAdminUser.Id, reviewers[0].Id)
	})

	t.Run("should return empty results when no reviewers match search term", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Search for non-existent user
		reviewers, appErr := th.App.SearchReviewers(th.Context, "nonexistentuser", th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 0)
	})

	t.Run("should return empty results when no reviewers configured", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Search should return no results
		reviewers, appErr := th.App.SearchReviewers(th.Context, th.BasicUser.Username, th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 0)
	})

	t.Run("should work with team reviewers and additional reviewers combined", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamReviewersSetting = map[string]*model.TeamReviewerSetting{
			th.BasicTeam.Id: {
				Enabled:     model.NewPointer(true),
				ReviewerIds: []string{th.BasicUser.Id},
			},
		}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Add system admin to team
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		defer func() {
			_ = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		}()

		// Search with empty term should return both team reviewer and system admin
		reviewers, appErr := th.App.SearchReviewers(th.Context, "", th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.True(t, len(reviewers) >= 2)

		reviewerIds := make([]string, len(reviewers))
		for i, reviewer := range reviewers {
			reviewerIds[i] = reviewer.Id
		}
		require.Contains(t, reviewerIds, th.BasicUser.Id)
		require.Contains(t, reviewerIds, th.SystemAdminUser.Id)
	})

	t.Run("should handle search by email and full name", func(t *testing.T) {
		config := getBaseConfig()
		config.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
		config.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)
		config.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)

		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		// Search by first name (if the user has one set)
		if th.BasicUser.FirstName != "" {
			reviewers, appErr := th.App.SearchReviewers(th.Context, th.BasicUser.FirstName, th.BasicTeam.Id)
			require.Nil(t, appErr)
			require.True(t, len(reviewers) >= 1)

			found := false
			for _, reviewer := range reviewers {
				if reviewer.Id == th.BasicUser.Id {
					found = true
					break
				}
			}
			require.True(t, found)
		}
	})
}

func TestGetReviewerPostsForFlaggedPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should return reviewer posts for flagged post", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		flaggedPostIdField, ok := mappedFields[contentFlaggingPropertyNameFlaggedPostId]
		require.True(t, ok)

		reviewerPostIds, appErr := th.App.getReviewerPostsForFlaggedPost(groupId, post.Id, flaggedPostIdField.ID)
		require.Nil(t, appErr)
		require.Len(t, reviewerPostIds, 1)

		// Verify the reviewer post exists and has the correct properties
		reviewerPost, appErr := th.App.GetSinglePost(th.Context, reviewerPostIds[0], false)
		require.Nil(t, appErr)
		require.Equal(t, model.ContentFlaggingPostType, reviewerPost.Type)
		require.Contains(t, reviewerPost.GetProps(), POST_PROP_KEY_FLAGGED_POST_ID)
		require.Equal(t, post.Id, reviewerPost.GetProps()[POST_PROP_KEY_FLAGGED_POST_ID])
	})

	t.Run("should return empty list when no reviewer posts exist", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))
		post := th.CreatePost(th.BasicChannel)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		flaggedPostIdField, ok := mappedFields[contentFlaggingPropertyNameFlaggedPostId]
		require.True(t, ok)

		reviewerPostIds, appErr := th.App.getReviewerPostsForFlaggedPost(groupId, post.Id, flaggedPostIdField.ID)
		require.Nil(t, appErr)
		require.Len(t, reviewerPostIds, 0)
	})

	t.Run("should handle multiple reviewer posts for same flagged post", func(t *testing.T) {
		// Create a config with multiple reviewers
		config := getBaseConfig(th)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id, th.BasicUser2.Id}
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.SystemAdminUser.Id, flagData)
		require.Nil(t, appErr)

		// Wait for async reviewer post creation to complete
		time.Sleep(2 * time.Second)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		flaggedPostIdField, ok := mappedFields[contentFlaggingPropertyNameFlaggedPostId]
		require.True(t, ok)

		reviewerPostIds, appErr := th.App.getReviewerPostsForFlaggedPost(groupId, post.Id, flaggedPostIdField.ID)
		require.Nil(t, appErr)
		require.Len(t, reviewerPostIds, 2)

		// Verify both reviewer posts exist and have correct properties
		for _, postId := range reviewerPostIds {
			reviewerPost, appErr := th.App.GetSinglePost(th.Context, postId, false)
			require.Nil(t, appErr)
			require.Equal(t, model.ContentFlaggingPostType, reviewerPost.Type)
			require.Contains(t, reviewerPost.GetProps(), POST_PROP_KEY_FLAGGED_POST_ID)
			require.Equal(t, post.Id, reviewerPost.GetProps()[POST_PROP_KEY_FLAGGED_POST_ID])
		}
	})

	t.Run("should handle invalid flagged post ID", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		flaggedPostIdField, ok := mappedFields[contentFlaggingPropertyNameFlaggedPostId]
		require.True(t, ok)

		reviewerPostIds, appErr := th.App.getReviewerPostsForFlaggedPost(groupId, "invalid_post_id", flaggedPostIdField.ID)
		require.Nil(t, appErr)
		require.Len(t, reviewerPostIds, 0)
	})
}

func TestPostReviewerMessage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should post reviewer message to thread", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		testMessage := "Test reviewer message"
		_, appErr = th.App.postReviewerMessage(th.Context, testMessage, groupId, post.Id)
		require.Nil(t, appErr)

		// Verify message was posted to the reviewer thread
		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		dmChannel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)

		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: dmChannel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)

		// Find the original review post and the test message
		var reviewPost *model.Post
		var testMessagePost *model.Post
		for _, p := range posts.Posts {
			if p.Type == "custom_spillage_report" {
				reviewPost = p
			} else if p.RootId != "" && p.Message == testMessage {
				testMessagePost = p
			}
		}
		require.NotNil(t, reviewPost)
		require.NotNil(t, testMessagePost)
		require.Equal(t, reviewPost.Id, testMessagePost.RootId)
		require.Equal(t, contentReviewBot.UserId, testMessagePost.UserId)
	})

	t.Run("should handle multiple reviewer channels", func(t *testing.T) {
		// Create a config with multiple reviewers
		config := getBaseConfig(th)
		config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id, th.BasicUser2.Id}
		appErr := th.App.SaveContentFlaggingConfig(config)
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}

		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.SystemAdminUser.Id, flagData)
		require.Nil(t, appErr)

		// Wait for async reviewer post creation to complete
		time.Sleep(2 * time.Second)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		testMessage := "Test message for multiple reviewers"
		_, appErr = th.App.postReviewerMessage(th.Context, testMessage, groupId, post.Id)
		require.Nil(t, appErr)

		// Verify message was posted to both reviewer threads
		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		// Check first reviewer's channel
		dmChannel1, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)

		posts1, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: dmChannel1.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)

		// Check second reviewer's channel
		dmChannel2, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser2.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)

		posts2, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: dmChannel2.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)

		// Verify test message exists in both channels
		var testMessagePost1, testMessagePost2 *model.Post
		for _, p := range posts1.Posts {
			if p.RootId != "" && p.Message == testMessage {
				testMessagePost1 = p
				break
			}
		}
		for _, p := range posts2.Posts {
			if p.RootId != "" && p.Message == testMessage {
				testMessagePost2 = p
				break
			}
		}
		require.NotNil(t, testMessagePost1)
		require.NotNil(t, testMessagePost2)
		require.Equal(t, contentReviewBot.UserId, testMessagePost1.UserId)
		require.Equal(t, contentReviewBot.UserId, testMessagePost2.UserId)
	})

	t.Run("should handle case when no reviewer posts exist", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))
		post := th.CreatePost(th.BasicChannel)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		testMessage := "Test message for non-flagged post"
		_, appErr = th.App.postReviewerMessage(th.Context, testMessage, groupId, post.Id)
		require.Nil(t, appErr)
	})

	t.Run("should handle message with special characters", func(t *testing.T) {
		require.Nil(t, setBaseConfig(th))

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		testMessage := "Test message with special chars: @user #channel ~team & <script>alert('xss')</script>"
		_, appErr = th.App.postReviewerMessage(th.Context, testMessage, groupId, post.Id)
		require.Nil(t, appErr)

		// Verify message was posted correctly with special characters preserved
		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		dmChannel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)

		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: dmChannel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)

		// Find the test message
		var testMessagePost *model.Post
		for _, p := range posts.Posts {
			if p.RootId != "" && p.Message == testMessage {
				testMessagePost = p
				break
			}
		}
		require.NotNil(t, testMessagePost)
		require.Equal(t, testMessage, testMessagePost.Message)
	})
}

// Helper function to setup notification config for testing
func setupNotificationConfig(th *TestHelper, eventTargetMapping map[model.ContentFlaggingEvent][]model.NotificationTarget) *model.AppError {
	config := getBaseConfig(th)
	config.NotificationSettings = &model.ContentFlaggingNotificationSettings{
		EventTargetMapping: eventTargetMapping,
	}
	return th.App.SaveContentFlaggingConfig(config)
}

// Helper function to verify post message content and properties
func verifyNotificationPost(t *testing.T, post *model.Post, expectedMessage string, expectedUserId string, expectedChannelId string) {
	require.NotNil(t, post)
	require.Equal(t, expectedMessage, post.Message)
	require.Equal(t, expectedUserId, post.UserId)
	require.Equal(t, expectedChannelId, post.ChannelId)
	require.True(t, post.CreateAt > 0)
	require.True(t, post.UpdateAt > 0)
}

func TestSendFlaggedPostRemovalNotification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should send notifications to all configured targets", func(t *testing.T) {
		// Setup notification config for all targets
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentRemoved: {model.TargetReviewers, model.TargetAuthor, model.TargetReporter},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		actorComment := "This post violates community guidelines"
		createdPosts := th.App.sendFlaggedPostRemovalNotification(th.Context, post, th.SystemAdminUser.Id, actorComment, groupId)

		// Should create 3 posts: reviewer message, author message, reporter message
		require.Len(t, createdPosts, 3)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		// Verify reviewer message
		reviewerMessage := fmt.Sprintf("The flagged message was removed by @%s\n\nWith comment:\n\n> %s", th.SystemAdminUser.Username, actorComment)
		var reviewerPost *model.Post
		for _, p := range createdPosts {
			if p.Message == reviewerMessage {
				reviewerPost = p
				break
			}
		}
		require.NotNil(t, reviewerPost)
		verifyNotificationPost(t, reviewerPost, reviewerMessage, contentReviewBot.UserId, reviewerPost.ChannelId)
		require.NotEmpty(t, reviewerPost.RootId) // Should be a thread reply to the flag review post

		// Verify author message
		authorMessage := fmt.Sprintf("Your post having ID `%s` in the channel `%s` which was flagged for review has been permanently removed by a reviewer.", post.Id, th.BasicChannel.DisplayName)
		var authorPost *model.Post
		for _, p := range createdPosts {
			if p.Message == authorMessage {
				authorPost = p
				break
			}
		}
		require.NotNil(t, authorPost)
		verifyNotificationPost(t, authorPost, authorMessage, contentReviewBot.UserId, authorPost.ChannelId)

		// Verify reporter message
		reporterMessage := fmt.Sprintf("The post having ID `%s` in the channel `%s` which you flagged for review has been permanently removed by a reviewer.", post.Id, th.BasicChannel.DisplayName)
		var reporterPost *model.Post
		for _, p := range createdPosts {
			if p.Message == reporterMessage {
				reporterPost = p
				break
			}
		}
		require.NotNil(t, reporterPost)
		verifyNotificationPost(t, reporterPost, reporterMessage, contentReviewBot.UserId, reporterPost.ChannelId)
	})

	t.Run("should send notifications only to configured targets", func(t *testing.T) {
		// Setup notification config for only author
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentRemoved: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		// Setup notification config for only author
		appErr = setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentRemoved: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		createdPosts := th.App.sendFlaggedPostRemovalNotification(th.Context, post, th.SystemAdminUser.Id, "Test comment", groupId)

		// Should create only 1 post for author
		require.Len(t, createdPosts, 1)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		expectedMessage := fmt.Sprintf("The flagged message was removed by @%s\n\nWith comment:\n\n> %s", th.SystemAdminUser.Username, "Test comment")
		verifyNotificationPost(t, createdPosts[0], expectedMessage, contentReviewBot.UserId, createdPosts[0].ChannelId)
	})

	t.Run("should handle empty comment", func(t *testing.T) {
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentRemoved: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		createdPosts := th.App.sendFlaggedPostRemovalNotification(th.Context, post, th.SystemAdminUser.Id, "", groupId)

		require.Len(t, createdPosts, 1)

		expectedMessage := fmt.Sprintf("The flagged message was removed by @%s", th.SystemAdminUser.Username)
		verifyNotificationPost(t, createdPosts[0], expectedMessage, createdPosts[0].UserId, createdPosts[0].ChannelId)
	})

	t.Run("should handle special characters in comment", func(t *testing.T) {
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentRemoved: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		specialComment := "Comment with @mentions #channels ~teams & <script>alert('xss')</script>"
		createdPosts := th.App.sendFlaggedPostRemovalNotification(th.Context, post, th.SystemAdminUser.Id, specialComment, groupId)

		require.Len(t, createdPosts, 1)

		expectedMessage := fmt.Sprintf("The flagged message was removed by @%s\n\nWith comment:\n\n> %s", th.SystemAdminUser.Username, specialComment)
		verifyNotificationPost(t, createdPosts[0], expectedMessage, createdPosts[0].UserId, createdPosts[0].ChannelId)
	})
}

func TestSendKeepFlaggedPostNotification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should send notifications to all configured targets", func(t *testing.T) {
		// Setup notification config for all targets
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentDismissed: {model.TargetReviewers, model.TargetAuthor, model.TargetReporter},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		actorComment := "This post is acceptable after review"
		createdPosts := th.App.sendKeepFlaggedPostNotification(th.Context, post, th.SystemAdminUser.Id, actorComment, groupId)

		// Should create 3 posts: reviewer message, author message, reporter message
		require.Len(t, createdPosts, 3)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		// Verify reviewer message
		reviewerMessage := fmt.Sprintf("The flagged message was retained by @%s\n\nWith comment:\n\n> %s", th.SystemAdminUser.Username, actorComment)
		var reviewerPost *model.Post
		for _, p := range createdPosts {
			if p.Message == reviewerMessage {
				reviewerPost = p
				break
			}
		}
		require.NotNil(t, reviewerPost)
		verifyNotificationPost(t, reviewerPost, reviewerMessage, contentReviewBot.UserId, reviewerPost.ChannelId)
		require.NotEmpty(t, reviewerPost.RootId) // Should be a thread reply

		// Verify author message
		authorMessage := fmt.Sprintf("Your post having ID `%s` in the channel `%s` which was flagged for review has been restored by a reviewer.", post.Id, th.BasicChannel.DisplayName)
		var authorPost *model.Post
		for _, p := range createdPosts {
			if p.Message == authorMessage {
				authorPost = p
				break
			}
		}
		require.NotNil(t, authorPost)
		verifyNotificationPost(t, authorPost, authorMessage, contentReviewBot.UserId, authorPost.ChannelId)

		// Verify reporter message
		reporterMessage := fmt.Sprintf("The post having ID `%s` in the channel `%s` which you flagged for review has been restored by a reviewer.", post.Id, th.BasicChannel.DisplayName)
		var reporterPost *model.Post
		for _, p := range createdPosts {
			if p.Message == reporterMessage {
				reporterPost = p
				break
			}
		}
		require.NotNil(t, reporterPost)
		verifyNotificationPost(t, reporterPost, reporterMessage, contentReviewBot.UserId, reporterPost.ChannelId)
	})

	t.Run("should send notifications only to configured targets", func(t *testing.T) {
		// Setup notification config for only reporter
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentDismissed: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		comment := "Test comment"
		createdPosts := th.App.sendKeepFlaggedPostNotification(th.Context, post, th.SystemAdminUser.Id, comment, groupId)

		// Should create only 1 post for reporter
		require.Len(t, createdPosts, 1)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		expectedMessage := fmt.Sprintf("The flagged message was retained by @%s\n\nWith comment:\n\n> %s", th.SystemAdminUser.Username, comment)
		verifyNotificationPost(t, createdPosts[0], expectedMessage, contentReviewBot.UserId, createdPosts[0].ChannelId)
	})

	t.Run("should handle empty comment", func(t *testing.T) {
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentDismissed: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		createdPosts := th.App.sendKeepFlaggedPostNotification(th.Context, post, th.SystemAdminUser.Id, "", groupId)

		require.Len(t, createdPosts, 1)

		expectedMessage := fmt.Sprintf("The flagged message was retained by @%s", th.SystemAdminUser.Username)
		verifyNotificationPost(t, createdPosts[0], expectedMessage, createdPosts[0].UserId, createdPosts[0].ChannelId)
	})

	t.Run("should handle special characters in comment", func(t *testing.T) {
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentDismissed: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		specialComment := "Comment with @mentions #channels ~teams & <script>alert('xss')</script>"
		createdPosts := th.App.sendKeepFlaggedPostNotification(th.Context, post, th.SystemAdminUser.Id, specialComment, groupId)

		require.Len(t, createdPosts, 1)

		expectedMessage := fmt.Sprintf("The flagged message was retained by @%s\n\nWith comment:\n\n> %s", th.SystemAdminUser.Username, specialComment)
		verifyNotificationPost(t, createdPosts[0], expectedMessage, createdPosts[0].UserId, createdPosts[0].ChannelId)
	})

	t.Run("should handle different actor users", func(t *testing.T) {
		appErr := setupNotificationConfig(th, map[model.ContentFlaggingEvent][]model.NotificationTarget{
			model.EventContentDismissed: {model.TargetReviewers},
		})
		require.Nil(t, appErr)

		post, appErr := setupFlaggedPost(th)
		require.Nil(t, appErr)

		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		// Use BasicUser as actor instead of SystemAdminUser
		createdPosts := th.App.sendKeepFlaggedPostNotification(th.Context, post, th.BasicUser.Id, "Reviewed by different user", groupId)

		require.Len(t, createdPosts, 1)

		expectedMessage := fmt.Sprintf("The flagged message was retained by @%s\n\nWith comment:\n\n> %s", th.BasicUser.Username, "Reviewed by different user")
		verifyNotificationPost(t, createdPosts[0], expectedMessage, createdPosts[0].UserId, createdPosts[0].ChannelId)
	})
}
