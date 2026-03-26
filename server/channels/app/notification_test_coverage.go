// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCanSendPushNotifications_ErrorPaths(t *testing.T) {
	t.Run("disabled by config", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = false
		})

		result := th.App.canSendPushNotifications()
		assert.False(t, result)
	})

	t.Run("MHPNS without license", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		servers := []string{
			model.MHPNS,
			model.MHPNSLegacyUS,
			model.MHPNSLegacyDE,
			model.MHPNSGlobal,
			model.MHPNSUS,
			model.MHPNSEU,
			model.MHPNSAP,
		}

		for _, server := range servers {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.EmailSettings.SendPushNotifications = true
				*cfg.EmailSettings.PushNotificationServer = server
			})

			result := th.App.canSendPushNotifications()
			assert.False(t, result, "Should be false for server: %s", server)
		}
	})

	t.Run("MHPNS with license but feature disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mhpnsFeature := false
		license := &model.License{
			Features: &model.Features{
				MHPNS: &mhpnsFeature,
			},
		}
		th.App.Srv().SetLicense(license)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = true
			*cfg.EmailSettings.PushNotificationServer = model.MHPNS
		})

		result := th.App.canSendPushNotifications()
		assert.False(t, result)
	})
}

func TestUserAllowsEmail_EdgeCases(t *testing.T) {
	t.Run("system message with comments notify", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		user := &model.User{
			Id: model.NewId(),
			NotifyProps: model.StringMap{
				model.EmailNotifyProp:         model.UserNotifyNone,
				model.CommentsNotifyProp:      model.CommentsNotifyRoot,
				model.PushStatusNotifyProp:    model.StatusAway,
				model.DesktopSoundNotifyProp:  "true",
				model.ChannelMentionsNotifyProp: "true",
			},
		}

		systemPost := &model.Post{
			Type: model.PostTypeSystemGeneric,
			Message: "system message",
		}

		channelProps := model.StringMap{
			model.EmailNotifyProp: model.ChannelNotifyDefault,
		}

		result := th.App.userAllowsEmail(th.Context, user, channelProps, systemPost)
		assert.False(t, result, "System messages should not trigger email notifications")
	})

	t.Run("urgent post overrides notify props", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		user := &model.User{
			Id: model.NewId(),
			NotifyProps: model.StringMap{
				model.EmailNotifyProp: model.UserNotifyNone,
			},
		}

		urgentPost := &model.Post{
			Message: "urgent message",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer(model.PostPriorityUrgent),
				},
			},
		}

		channelProps := model.StringMap{
			model.EmailNotifyProp: model.ChannelNotifyDefault,
		}

		result := th.App.userAllowsEmail(th.Context, user, channelProps, urgentPost)
		assert.True(t, result, "Urgent posts should override notification preferences")
	})

	t.Run("channel notify all overrides user setting", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		user := &model.User{
			Id: model.NewId(),
			NotifyProps: model.StringMap{
				model.EmailNotifyProp: model.UserNotifyNone,
			},
		}

		post := &model.Post{
			Message: "test message",
		}

		channelProps := model.StringMap{
			model.EmailNotifyProp: model.ChannelNotifyAll,
		}

		result := th.App.userAllowsEmail(th.Context, user, channelProps, post)
		assert.True(t, result, "Channel notify all should override user none setting")
	})
}

func TestSendNoUsersNotifiedByGroupInChannel(t *testing.T) {
	th := Setup(t).InitBasic(t)

	groupName := "testgroup"
	group := &model.Group{
		Id:          model.NewId(),
		Name:        &groupName,
		DisplayName: "Test Group",
	}

	post := &model.Post{
		Id:        model.NewId(),
		ChannelId: th.BasicChannel.Id,
		Message:   "@testgroup",
	}

	// This should not panic and complete successfully
	th.App.sendNoUsersNotifiedByGroupInChannel(th.Context, th.BasicUser, post, th.BasicChannel, group)
}

func TestFilterUsersByVisible_ErrorPaths(t *testing.T) {
	t.Run("nil viewer", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		otherUsers := []*model.User{th.BasicUser2}

		filtered, err := th.App.FilterUsersByVisible(th.Context, nil, otherUsers)
		assert.NotNil(t, err)
		assert.Nil(t, filtered)
	})

	t.Run("empty user list", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		filtered, err := th.App.FilterUsersByVisible(th.Context, th.BasicUser, []*model.User{})
		assert.Nil(t, err)
		assert.Empty(t, filtered)
	})

	t.Run("filters deactivated users", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		deactivatedUser := th.CreateUser(t)
		_, err := th.App.UpdateActive(th.Context, deactivatedUser, false)
		require.Nil(t, err)

		otherUsers := []*model.User{th.BasicUser2, deactivatedUser}

		filtered, err := th.App.FilterUsersByVisible(th.Context, th.BasicUser, otherUsers)
		assert.Nil(t, err)
		assert.Len(t, filtered, 1)
		assert.Equal(t, th.BasicUser2.Id, filtered[0].Id)
	})
}

func TestGetGroupsAllowedForReferenceInChannel_ErrorCases(t *testing.T) {
	t.Run("direct channel returns empty", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		groups, err := th.App.getGroupsAllowedForReferenceInChannel(dm, th.BasicTeam)
		assert.NoError(t, err)
		assert.Empty(t, groups)
	})

	t.Run("group message channel returns empty", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		gm := &model.Channel{
			Type: model.ChannelTypeGroup,
		}

		groups, err := th.App.getGroupsAllowedForReferenceInChannel(gm, th.BasicTeam)
		assert.NoError(t, err)
		assert.Empty(t, groups)
	})
}

func TestInsertGroupMentions_ErrorPaths(t *testing.T) {
	t.Run("group with no members", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		emptyGroupName := "emptygroup"
		group := &model.Group{
			Id:          model.NewId(),
			Name:        &emptyGroupName,
			DisplayName: "Empty Group",
		}

		mentions := &MentionResults{
			Mentions: make(map[string]MentionType),
		}
		profileMap := make(map[string]*model.User)

		anyMentioned, err := th.App.insertGroupMentions(
			th.BasicUser.Id,
			group,
			th.BasicChannel,
			profileMap,
			mentions,
		)

		assert.NoError(t, err)
		assert.False(t, anyMentioned)
		assert.Empty(t, mentions.Mentions)
	})

	t.Run("group with inactive members only", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		group := th.CreateGroup(t)

		inactiveUser := th.CreateUser(t)
		_, err := th.App.UpdateActive(th.Context, inactiveUser, false)
		require.Nil(t, err)

		_, err = th.App.UpsertGroupMember(group.Id, inactiveUser.Id)
		require.Nil(t, err)

		mentions := &MentionResults{
			Mentions: make(map[string]MentionType),
		}
		profileMap := map[string]*model.User{
			inactiveUser.Id: inactiveUser,
		}

		anyMentioned, err := th.App.insertGroupMentions(
			th.BasicUser.Id,
			group,
			th.BasicChannel,
			profileMap,
			mentions,
		)

		assert.NoError(t, err)
		assert.False(t, anyMentioned)
		assert.Empty(t, mentions.Mentions)
	})
}

func TestGetMentionKeywordsInChannel_EdgeCases(t *testing.T) {
	t.Run("with channel mentions disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		profiles := map[string]*model.User{
			th.BasicUser.Id: {
				Id:       th.BasicUser.Id,
				Username: th.BasicUser.Username,
				NotifyProps: model.StringMap{
					model.ChannelMentionsNotifyProp: "false",
				},
			},
		}

		channelMemberProps := map[string]model.StringMap{
			th.BasicUser.Id: {
				model.MarkUnreadNotifyProp: model.UserNotifyAll,
			},
		}

		keywords := th.App.getMentionKeywordsInChannel(
			profiles,
			true, // allowChannelMentions
			channelMemberProps,
			nil, // groups
		)

		// Should not include @all, @here, @channel when disabled for user
		_, hasAll := keywords["@all"]
		_, hasHere := keywords["@here"]
		_, hasChannel := keywords["@channel"]
		assert.False(t, hasAll)
		assert.False(t, hasHere)
		assert.False(t, hasChannel)
	})

	t.Run("with custom mention keywords", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		profiles := map[string]*model.User{
			th.BasicUser.Id: {
				Id:       th.BasicUser.Id,
				Username: th.BasicUser.Username,
				NotifyProps: model.StringMap{
					model.MentionKeysNotifyProp:     "custom1,custom2",
					model.ChannelMentionsNotifyProp: "true",
				},
			},
		}

		channelMemberProps := map[string]model.StringMap{
			th.BasicUser.Id: {},
		}

		keywords := th.App.getMentionKeywordsInChannel(
			profiles,
			true,
			channelMemberProps,
			nil,
		)

		_, hasCustom1 := keywords["custom1"]
		_, hasCustom2 := keywords["custom2"]
		_, hasUsername := keywords["@"+th.BasicUser.Username]
		assert.True(t, hasCustom1)
		assert.True(t, hasCustom2)
		assert.True(t, hasUsername)
	})
}

func TestRemoveNotifications_ErrorPaths(t *testing.T) {
	t.Run("remove from archived channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			Message:   "test",
		}

		archivedChannel := &model.Channel{
			Id:       th.BasicChannel.Id,
			DeleteAt: model.GetMillis(),
		}

		err := th.App.RemoveNotifications(th.Context, post, archivedChannel)
		assert.NoError(t, err) // Should succeed without doing anything
	})
}

func TestCountNotificationReason_EdgeCases(t *testing.T) {
	t.Run("with metrics disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = false
		})

		// Should not panic when metrics are disabled
		th.App.CountNotificationReason(
			model.NotificationStatusError,
			model.NotificationTypePush,
			model.NotificationReasonFetchError,
			model.NotificationNoPlatform,
		)
	})

	t.Run("with all notification types and reasons", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
		})

		statuses := []model.NotificationStatus{
			model.NotificationStatusSuccess,
			model.NotificationStatusNotSent,
			model.NotificationStatusError,
		}

		types := []model.NotificationType{
			model.NotificationTypePush,
			model.NotificationTypeEmail,
			model.NotificationTypeWebsocket,
		}

		reasons := []model.NotificationReason{
			model.NotificationReasonFetchError,
			model.NotificationReasonMissingProfile,
			model.NotificationReasonChannelMuted,
		}

		// Only use the one platform constant that exists
		platforms := []string{
			model.NotificationNoPlatform,
		}

		// Test all combinations - should not panic
		for _, status := range statuses {
			for _, notifType := range types {
				for _, reason := range reasons {
					for _, platform := range platforms {
						th.App.CountNotificationReason(status, notifType, reason, platform)
					}
				}
			}
		}
	})
}