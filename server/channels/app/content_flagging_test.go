// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

var getBaseConfig = func() *model.Config {
	contentFlaggingSettings := model.ContentFlaggingSettings{}
	contentFlaggingSettings.SetDefaults()

	return &model.Config{
		ContentFlaggingSettings: contentFlaggingSettings,
	}
}

func TestContentFlaggingEnabledForTeam(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("should return true for common reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{"reviewer_user_id_1", "reviewer_user_id_2"}

		status := ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status, "expected team post reporting feature to be enabled for common reviewers")
	})

	t.Run("should return true when configured for specified team", func(t *testing.T) {
		config := getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
			"team1": {
				Enabled:     model.NewPointer(true),
				ReviewerIds: model.NewPointer([]string{"reviewer_user_id_1"}),
			},
		}

		status := ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status, "expected team post reporting feature to be disabled for team without reviewers")
	})

	t.Run("should return true when using Additional Reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
			"team1": {
				Enabled: model.NewPointer(true),
			},
		}

		status := ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status)

		config = getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
		config.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		status = ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status)

		config = getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		status = ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status)
	})
}

func TestGetContentReviewChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	baseConfig := model.ContentFlaggingSettings{}
	baseConfig.SetDefaults()
	baseConfig.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
	baseConfig.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
	baseConfig.ReviewerSettings.CommonReviewers = model.NewPointer(true)
	baseConfig.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id, th.BasicUser2.Id}

	t.Run("should return channels for common reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings = baseConfig
		})

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
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings = baseConfig
			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		// Sysadmin explicitly need to be a team member to be returned as reviewer
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
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
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings = baseConfig
			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		})

		// Create a new user and make them team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
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
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings = baseConfig

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}

			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(false)

			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{th.BasicUser2.Id}),
				},
			}
		})

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
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings = baseConfig

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(false),
					ReviewerIds: model.NewPointer([]string{th.BasicUser.Id}),
				},
			}
		})

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 0)
	})

	t.Run("should return channels for additional reviewers with team reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings = baseConfig

			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{th.BasicUser2.Id}),
				},
			}
		})

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
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
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id, th.BasicUser2.Id}
		})

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, th.BasicUser2.Id)
	})

	t.Run("should return system admins as additional reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		// Sysadmin explicitly need to be a team member to be returned as reviewer
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)

		// system admin is a reviewer even when there are no common reviewers
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{}
		})
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)

		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

		// If sysadmin is not a team member, they should not be returned as a reviewer
		appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.BasicUser.Id)
	})

	t.Run("should return team admins as additional reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		})

		// Create a new user and make them team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, teamAdmin.Id)

		// team admin is a reviewer even when there are no common reviewers
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{}
		})

		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, teamAdmin.Id)

		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

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
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{th.BasicUser2.Id}),
				},
			}
		})

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
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(false),
					ReviewerIds: model.NewPointer([]string{th.BasicUser.Id}),
				},
			}
		})

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 0)
	})

	t.Run("should return additional reviewers with team reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{th.BasicUser2.Id}),
				},
			}
		})

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id, true)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser2.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)
	})

	t.Run("should return unique reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id, th.SystemAdminUser.Id}
			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
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

	// Setup base config for content flagging
	baseConfig := model.ContentFlaggingSettings{}
	baseConfig.SetDefaults()
	baseConfig.ReviewerSettings.CommonReviewers = model.NewPointer(true)
	baseConfig.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
	baseConfig.AdditionalSettings.ReporterCommentRequired = model.NewPointer(false)
	baseConfig.AdditionalSettings.HideFlaggedContent = model.NewPointer(false)
	baseConfig.AdditionalSettings.Reasons = &[]string{"spam", "harassment", "inappropriate"}

	th.UpdateConfig(func(conf *model.Config) {
		conf.ContentFlaggingSettings = baseConfig
	})

	t.Run("should successfully flag a post with valid data", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"This is spam content\"",
		}

		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Verify property values were created
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		// Check status property
		statusValues, err := th.Server.propertyService.SearchPropertyValues(groupId, post.Id, model.PropertyValueSearchOpts{
			PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID: mappedFields[contentFlaggingPropertyNameStatus].ID,
		})
		require.NoError(t, err)
		require.Len(t, statusValues, 1)
		require.Equal(t, `"`+model.ContentFlaggingStatusPending+`"`, string(statusValues[0].Value))

		// Check reporting user property
		userValues, err := th.Server.propertyService.SearchPropertyValues(groupId, post.Id, model.PropertyValueSearchOpts{
			PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID: mappedFields[contentFlaggingPropertyNameReportingUserID].ID,
		})
		require.NoError(t, err)
		require.Len(t, userValues, 1)
		require.Equal(t, `"`+th.BasicUser2.Id+`"`, string(userValues[0].Value))

		// Check reason property
		reasonValues, err := th.Server.propertyService.SearchPropertyValues(groupId, post.Id, model.PropertyValueSearchOpts{
			PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID: mappedFields[contentFlaggingPropertyNameReportingReason].ID,
		})
		require.NoError(t, err)
		require.Len(t, reasonValues, 1)
		require.Equal(t, `"spam"`, string(reasonValues[0].Value))

		// Check comment property
		commentValues, err := th.Server.propertyService.SearchPropertyValues(groupId, post.Id, model.PropertyValueSearchOpts{
			PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID: mappedFields[contentFlaggingPropertyNameReportingComment].ID,
		})
		require.NoError(t, err)
		require.Len(t, commentValues, 1)
		require.Equal(t, `"This is spam content"`, string(commentValues[0].Value))
	})

	t.Run("should fail with invalid reason", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "invalid_reason",
			Comment: "This is spam content",
		}

		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.NotNil(t, appErr)
		require.Equal(t, "api.content_flagging.error.reason_invalid", appErr.Id)
	})

	t.Run("should fail when comment is required but not provided", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired = model.NewPointer(true)
		})

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "",
		}

		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.NotNil(t, appErr)

		// Reset config
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired = model.NewPointer(false)
		})
	})

	t.Run("should fail when trying to flag already flagged post", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"This is spam content\"",
		}

		// Flag the post first time
		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Try to flag the same post again
		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.NotNil(t, appErr)
		require.Equal(t, "Cannot flag this post as is already flagged.", appErr.Id)
	})

	t.Run("should hide flagged content when configured", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent = model.NewPointer(true)
		})

		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"This is spam content\"",
		}

		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Verify post was deleted
		deletedPost, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
		require.NotNil(t, appErr)
		require.Nil(t, deletedPost)

		// Reset config
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent = model.NewPointer(false)
		})
	})

	t.Run("should create content review post for reviewers", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "harassment",
			Comment: "\"This is harassment\"",
		}

		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// The reviewer posts are created async in a go routine. Wait for a short time to allow it to complete.
		// 2 seconds is the minimum time when the test consistently passes locally and in CI.
		time.Sleep(2 * time.Second)

		// Get the content review bot
		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		// Get direct channel between reviewer and bot
		dmChannel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)

		// Check if review post was created in the DM channel
		posts, appErr := th.App.GetPostsPage(model.GetPostsOptions{
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
		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "inappropriate",
			Comment: "",
		}

		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		// Verify property values were created with empty comment
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		commentValues, err := th.Server.propertyService.SearchPropertyValues(groupId, post.Id, model.PropertyValueSearchOpts{
			PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID: mappedFields[contentFlaggingPropertyNameReportingComment].ID,
		})
		require.NoError(t, err)
		require.Len(t, commentValues, 1)
		require.Equal(t, `""`, string(commentValues[0].Value))
	})

	t.Run("should set reporting time property", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "\"Test comment\"",
		}

		beforeTime := model.GetMillis()
		appErr := th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		afterTime := model.GetMillis()
		require.Nil(t, appErr)

		// Verify reporting time property was set
		groupId, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)

		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupId)
		require.Nil(t, appErr)

		timeValues, err := th.Server.propertyService.SearchPropertyValues(groupId, post.Id, model.PropertyValueSearchOpts{
			PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES,
			FieldID: mappedFields[contentFlaggingPropertyNameReportingTime].ID,
		})
		require.NoError(t, err)
		require.Len(t, timeValues, 1)

		var reportingTime int64
		err = json.Unmarshal(timeValues[0].Value, &reportingTime)
		require.NoError(t, err)
		require.True(t, reportingTime >= beforeTime && reportingTime <= afterTime)
	})
}
