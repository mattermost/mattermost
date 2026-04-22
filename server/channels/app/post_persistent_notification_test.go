// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestResolvePersistentNotification(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should not delete when no posts exist", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		post := &model.Post{Id: "test id"}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(nil, &store.ErrNotFound{})
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.ResolvePersistentNotification(th.Context, post, "")
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete for mentioned user", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @" + user1.Username, UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(&model.PostPersistentNotifications{PostId: post.Id}, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{team}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.ResolvePersistentNotification(th.Context, post, user1.Id)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not delete for post owner", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1"}
		post := &model.Post{Id: "test id", UserId: user1.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		err := th.App.ResolvePersistentNotification(th.Context, post, user1.Id)
		require.Nil(t, err)

		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not delete for non-mentioned user", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		user3 := &model.User{Id: "uid3", Username: "user-3"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2, user3.Id: user3}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @" + user1.Username, UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(&model.PostPersistentNotifications{PostId: post.Id}, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{team}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.ResolvePersistentNotification(th.Context, post, user3.Id)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})
}

func TestDeletePersistentNotification(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should not delete when no posts exist", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		post := &model.Post{Id: "test id"}

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(nil, &store.ErrNotFound{})
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.DeletePersistentNotification(th.Context, post)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		post := &model.Post{Id: "test id"}

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(&model.PostPersistentNotifications{PostId: post.Id}, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true

		err := th.App.DeletePersistentNotification(th.Context, post)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})
}

func TestForEachPersistentNotificationPost(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("should cleanup posts whose channel no longer exists", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		profileMap := map[string]*model.User{user1.Id: user1}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}

		// post1 belongs to an existing channel; post2 belongs to a deleted/missing channel
		post1 := &model.Post{Id: "pid1", ChannelId: channel.Id, Message: "hello @user-1", UserId: user1.Id}
		post2 := &model.Post{Id: "pid2", ChannelId: "deleted-channel-id", Message: "hello", UserId: user1.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		// Only return channel for post1; post2's channel is missing
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{team}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		// DeletePersistentNotification mocks - the cleanup path calls GetSingle then Delete
		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", post2.Id).Return(&model.PostPersistentNotifications{PostId: post2.Id}, nil)
		mockPostPersistentNotification.On("Delete", []string{post2.Id}).Return(nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotifications = true

		fnCalled := []string{}
		err := th.App.forEachPersistentNotificationPost([]*model.Post{post1, post2}, func(post *model.Post, _ *model.Channel, _ *model.Team, _ *MentionResults, _ model.UserMap, _ map[string]map[string]model.StringMap) error {
			fnCalled = append(fnCalled, post.Id)
			return nil
		})
		require.NoError(t, err)

		// The callback should only be called for post1 (valid channel)
		assert.Equal(t, []string{"pid1"}, fnCalled)
		// post2 persistent notification should have been cleaned up
		mockPostPersistentNotification.AssertCalled(t, "Delete", []string{post2.Id})
	})

	t.Run("should cleanup posts whose team no longer exists", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		// channelWithMissingTeam has a TeamId that won't be in teamsMap
		channelWithMissingTeam := &model.Channel{Id: "chid2", TeamId: "deleted-team-id", Type: model.ChannelTypeOpen}

		post1 := &model.Post{Id: "pid1", ChannelId: channel.Id, Message: "hello @user-1", UserId: user2.Id}
		post2 := &model.Post{Id: "pid2", ChannelId: channelWithMissingTeam.Id, Message: "hello @user-1", UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		// Both channels exist, but only one team exists
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel, channelWithMissingTeam}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		// Only return the team for channel, not for channelWithMissingTeam
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{team}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", post2.Id).Return(&model.PostPersistentNotifications{PostId: post2.Id}, nil)
		mockPostPersistentNotification.On("Delete", []string{post2.Id}).Return(nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotifications = true

		fnCalled := []string{}
		err := th.App.forEachPersistentNotificationPost([]*model.Post{post1, post2}, func(post *model.Post, _ *model.Channel, _ *model.Team, _ *MentionResults, _ model.UserMap, _ map[string]map[string]model.StringMap) error {
			fnCalled = append(fnCalled, post.Id)
			return nil
		})
		require.NoError(t, err)

		// The callback should only be called for post1 (valid team)
		assert.Equal(t, []string{"pid1"}, fnCalled)
		// post2 persistent notification should have been cleaned up due to missing team
		mockPostPersistentNotification.AssertCalled(t, "Delete", []string{post2.Id})
	})

	t.Run("should not cleanup DM posts that have no team", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2}
		dmChannel := &model.Channel{Id: "dm-chid", TeamId: "", Type: model.ChannelTypeDirect, Name: model.GetDMNameFromIds(user1.Id, user2.Id)}

		post1 := &model.Post{Id: "pid1", ChannelId: dmChannel.Id, Message: "hello", UserId: user1.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{dmChannel}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotifications = true

		fnCalled := []string{}
		err := th.App.forEachPersistentNotificationPost([]*model.Post{post1}, func(post *model.Post, _ *model.Channel, _ *model.Team, _ *MentionResults, _ model.UserMap, _ map[string]map[string]model.StringMap) error {
			fnCalled = append(fnCalled, post.Id)
			return nil
		})
		require.NoError(t, err)

		// The callback should be called for the DM post even though there's no team
		assert.Equal(t, []string{"pid1"}, fnCalled)
		// Delete should NOT have been called — DMs don't need a team
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not cleanup GM posts that have no team", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		user3 := &model.User{Id: "uid3", Username: "user-3"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2, user3.Id: user3}
		gmChannel := &model.Channel{Id: "gm-chid", TeamId: "", Type: model.ChannelTypeGroup}

		post1 := &model.Post{Id: "pid1", ChannelId: gmChannel.Id, Message: "hello @user-2", UserId: user1.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{gmChannel}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotifications = true

		fnCalled := []string{}
		err := th.App.forEachPersistentNotificationPost([]*model.Post{post1}, func(post *model.Post, _ *model.Channel, _ *model.Team, _ *MentionResults, _ model.UserMap, _ map[string]map[string]model.StringMap) error {
			fnCalled = append(fnCalled, post.Id)
			return nil
		})
		require.NoError(t, err)

		// The callback should be called for the GM post even though there's no team
		assert.Equal(t, []string{"pid1"}, fnCalled)
		// Delete should NOT have been called — GMs don't need a team
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})
}

func TestSendPersistentNotifications(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)

	s := "Urgent"
	tr := true
	p1 := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "test " + "@" + th.BasicUser2.Username,
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                &s,
				PersistentNotifications: &tr,
			},
		},
	}
	_, _, appErr = th.App.CreatePost(th.Context, p1, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	err := th.App.SendPersistentNotifications()
	require.NoError(t, err)
}

func TestSendPersistentNotificationsBotSender(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should send notification when bot is sender", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "testbot",
			DisplayName: "Test Bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, appErr)

		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, botUser.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, botUser, th.BasicChannel, false)
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
		require.Nil(t, appErr)

		post := &model.Post{
			UserId:    bot.UserId,
			ChannelId: th.BasicChannel.Id,
			Message:   "test " + "@" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					PersistentNotifications: model.NewPointer(true),
				},
			},
			// Simulate old timestamp so persistent notifications are sent right away
			CreateAt: time.Now().Add(-5 * time.Minute).UnixMilli(),
		}
		post, _, appErr = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		assert.EventuallyWithT(t, func(c *assert.CollectT) {
			err := th.App.SendPersistentNotifications()
			require.NoError(t, err)

			persistentPostNotification, err := th.App.Srv().Store().PostPersistentNotification().GetSingle(post.Id)
			require.NoError(c, err)
			require.NotNil(c, persistentPostNotification)
			assert.Greater(c, persistentPostNotification.SentCount, int16(0))
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestSendPersistentNotificationsBotSenderNotInChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should send notification when bot sender is not a channel member", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "testbot",
			DisplayName: "Test Bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, appErr)

		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)

		// Make the bot a system admin so it can post to channels it's not a member of
		_, appErr = th.App.UpdateUserRoles(th.Context, botUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
		require.Nil(t, appErr)

		// Note: bot is NOT added to the team or channel

		post := &model.Post{
			UserId:    bot.UserId,
			ChannelId: th.BasicChannel.Id,
			Message:   "test " + "@" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					PersistentNotifications: model.NewPointer(true),
				},
			},
			CreateAt: time.Now().Add(-5 * time.Minute).UnixMilli(),
		}
		post, _, appErr = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		assert.EventuallyWithT(t, func(c *assert.CollectT) {
			err := th.App.SendPersistentNotifications()
			require.NoError(t, err)

			persistentPostNotification, err := th.App.Srv().Store().PostPersistentNotification().GetSingle(post.Id)
			require.NoError(c, err)
			require.NotNil(c, persistentPostNotification)
			assert.Greater(c, persistentPostNotification.SentCount, int16(0))
		}, 5*time.Second, 100*time.Millisecond)
	})
}
