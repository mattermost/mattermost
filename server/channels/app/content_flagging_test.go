// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

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
	t.Parallel()

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	t.Run("should create direct channels with content review bot for common reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id, th.BasicUser2.Id}
		})

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, contentReviewBot)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 2)

		// Verify channels are direct message channels
		for _, channel := range channels {
			require.Equal(t, model.ChannelTypeDirect, channel.Type)
			require.Contains(t, []string{th.BasicUser.Id, th.BasicUser2.Id}, channel.GetOtherUserIdForDM(contentReviewBot.UserId))
		}
	})

	t.Run("should create direct channels for team admins as reviewers", func(t *testing.T) {
		// Create a new user and make them team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled: model.NewPointer(true),
				},
			}
		})

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 1)

		// Verify channel is a direct message channel with the team admin
		channel := channels[0]
		require.Equal(t, model.ChannelTypeDirect, channel.Type)
		require.Equal(t, teamAdmin.Id, channel.GetOtherUserIdForDM(contentReviewBot.UserId))
	})

	t.Run("should create direct channels for system admins as reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled: model.NewPointer(true),
				},
			}
		})

		// Add system admin to team
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 1)

		// Verify channel is a direct message channel with the system admin
		channel := channels[0]
		require.Equal(t, model.ChannelTypeDirect, channel.Type)
		require.Equal(t, th.SystemAdminUser.Id, channel.GetOtherUserIdForDM(contentReviewBot.UserId))
	})

	t.Run("should create direct channels for team-specific reviewers", func(t *testing.T) {
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				th.BasicTeam.Id: {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{th.BasicUser.Id, th.BasicUser2.Id}),
				},
			}
		})

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 2)

		// Verify channels are direct message channels
		reviewerIds := []string{}
		for _, channel := range channels {
			require.Equal(t, model.ChannelTypeDirect, channel.Type)
			reviewerIds = append(reviewerIds, channel.GetOtherUserIdForDM(contentReviewBot.UserId))
		}
		require.Contains(t, reviewerIds, th.BasicUser.Id)
		require.Contains(t, reviewerIds, th.BasicUser2.Id)
	})

	t.Run("should return empty channels when no reviewers configured", func(t *testing.T) {
		team2 := th.CreateTeam()
		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			conf.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{}
		})

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		channels, appErr := th.App.getContentReviewChannels(th.Context, team2.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 0)
	})

	t.Run("should handle mixed reviewer types", func(t *testing.T) {
		// Create a team admin
		teamAdmin := th.CreateUser()
		defer func() {
			_ = th.App.PermanentDeleteUser(th.Context, teamAdmin)
		}()

		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, model.TeamAdminRoleId)
		require.Nil(t, appErr)

		// Add system admin to team
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		th.UpdateConfig(func(conf *model.Config) {
			contentFlaggingSettings := model.ContentFlaggingSettings{}
			contentFlaggingSettings.SetDefaults()

			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
			conf.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
			conf.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
		require.Nil(t, appErr)

		channels, appErr := th.App.getContentReviewChannels(th.Context, th.BasicTeam.Id, contentReviewBot.UserId)
		require.Nil(t, appErr)
		require.Len(t, channels, 3)

		// Verify all expected reviewers have channels
		reviewerIds := []string{}
		for _, channel := range channels {
			require.Equal(t, model.ChannelTypeDirect, channel.Type)
			reviewerIds = append(reviewerIds, channel.GetOtherUserIdForDM(contentReviewBot.UserId))
		}
		require.Contains(t, reviewerIds, th.BasicUser.Id)
		require.Contains(t, reviewerIds, teamAdmin.Id)
		require.Contains(t, reviewerIds, th.SystemAdminUser.Id)
	})
}

func TestGetReviewersForTeam(t *testing.T) {
	t.Parallel()

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

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id)
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
		//var appErr *model.AppError
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)

		// system admin is a reviewer even when there are no common reviewers
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{}
		})
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)

		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

		// If sysadmin is not a team member, they should not be returned as a reviewer
		appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.SystemAdminUser.Id, "")
		require.Nil(t, appErr)
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id)
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

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser.Id)
		require.Contains(t, reviewers, teamAdmin.Id)

		// team admin is a reviewer even when there are no common reviewers
		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{}
		})

		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, teamAdmin.Id)

		th.UpdateConfig(func(conf *model.Config) {
			conf.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{th.BasicUser.Id}
		})

		// If team admin is not a team member, they should not be returned as a reviewer
		appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, teamAdmin.Id, "")
		require.Nil(t, appErr)
		reviewers, appErr = th.App.getReviewersForTeam(th.BasicTeam.Id)
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
		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 1)
		require.Contains(t, reviewers, th.BasicUser2.Id)

		// NO reviewers configured for team2
		reviewers, appErr = th.App.getReviewersForTeam(team2.Id)
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

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id)
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

		reviewers, appErr := th.App.getReviewersForTeam(th.BasicTeam.Id)
		require.Nil(t, appErr)
		require.Len(t, reviewers, 2)
		require.Contains(t, reviewers, th.BasicUser2.Id)
		require.Contains(t, reviewers, th.SystemAdminUser.Id)
	})
}
