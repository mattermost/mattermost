// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	storemocks "github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDeletePersistentNotificationsPost(t *testing.T) {
	t.Run("should not delete when no posts exist", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.DeletePersistentNotificationsPost(th.Context, post, "", false)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete without checking mentions when checkMentionedUser is false", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: post.Id}}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{}, nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.DeletePersistentNotificationsPost(th.Context, post, "", false)
		require.Nil(t, err)

		mockChannel.AssertNotCalled(t, "GetChannelsByIds", mock.Anything, mock.Anything)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete for mentioned user", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @" + user1.Username, UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: post.Id}}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)

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

		err := th.App.DeletePersistentNotificationsPost(th.Context, post, user1.Id, true)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not delete for mentioned post owner", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		post := &model.Post{Id: "test id", UserId: user1.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: post.Id}}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{}, nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.DeletePersistentNotificationsPost(th.Context, post, user1.Id, true)
		require.Nil(t, err)

		mockChannel.AssertNotCalled(t, "GetChannelsByIds", mock.Anything, mock.Anything)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not delete for non-mentioned user", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @" + user1.Username, UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: post.Id}}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)

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

		err := th.App.DeletePersistentNotificationsPost(th.Context, post, user2.Id, true)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})
}

func TestSendPersistentNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)

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
	_, appErr := th.App.CreatePost(th.Context, p1, th.BasicChannel, false, false)
	require.Nil(t, appErr)

	err := th.App.SendPersistentNotifications()
	require.NoError(t, err)
}
